/* server.js — Serveur backend de LearnWithUs
   Lance le serveur : npm run dev (dev) ou npm start (prod) */

const express   = require('express')
const cors      = require('cors')
const dotenv    = require('dotenv')
const bcrypt    = require('bcryptjs')
const jwt       = require('jsonwebtoken')
const rateLimit = require('express-rate-limit')
const { Client } = require('@notionhq/client')

dotenv.config()

/* Client Notion initialisé avec le token d'intégration */
const notion = new Client({ auth: process.env.NOTION_TOKEN })
const NOTION_DATABASE_ID           = process.env.NOTION_DATABASE_ID
const NOTION_DATABASE_COMPTES_ID   = process.env.NOTION_DATABASE_COMPTES_ID
/* Data source ID de la base "Comptes LearnWithUs" — requis pour les
   requêtes (notion.dataSources.query dans le SDK @notionhq/client v5+) */
const NOTION_DS_COMPTES_ID         = process.env.NOTION_DS_COMPTES_ID
/* Data source ID de la base "CRM LearnWithUs" — centralise tous les
   leads et clients (inscriptions, création compte, paiement, contact) */
const NOTION_DS_CRM_ID             = process.env.NOTION_DS_CRM_ID
/* Data source ID de la base "Transactions LearnWithUs" — historique des
   paiements Premium. Aucune donnée bancaire n'est stockée (RGPD / PCI DSS) */
const NOTION_DS_TRANSACTIONS_ID    = process.env.NOTION_DS_TRANSACTIONS_ID
/* Data source ID de la base "Inscriptions Formations" — requis pour le
   dashboard admin (stats + dernières inscriptions) */
const NOTION_DS_INSCRIPTIONS_ID    = process.env.NOTION_DS_INSCRIPTIONS_ID
/* Liste des emails ayant accès à l'espace admin (séparés par des virgules
   dans la variable d'environnement ADMIN_EMAILS) */
const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || '')
  .split(',')
  .map(e => e.trim().toLowerCase())
  .filter(e => e.length > 0)
/* Secret utilisé pour signer les jetons JWT (à définir en prod via Render) */
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-a-remplacer-en-prod'

const app = express()


/* ===== MIDDLEWARE ===== */
/* Autorise les requêtes cross-origin depuis le frontend Vercel */
const originesAutorisées = [
  'http://localhost:5500',
  'http://localhost:3000',
  'https://learn-with-us-lac.vercel.app'
]
app.use(cors({
  origin: originesAutorisées,
  methods: ['GET', 'POST']
}))

/* Parse le corps des requêtes POST en JSON */
app.use(express.json())

/* Render place un proxy devant les services — on fait confiance à sa première
   en-tête X-Forwarded-For pour avoir la vraie IP client (requis par rate-limit) */
app.set('trust proxy', 1)

/* Limite 5 tentatives / 15 min par IP sur les endpoints sensibles (connexion,
   création de compte, demande reset) pour bloquer les attaques par force
   brute et le spam de création de compte. */
const limiteurAuth = rateLimit({
  windowMs: 15 * 60 * 1000,
  max:      5,
  standardHeaders: true,
  legacyHeaders:   false,
  message: {
    succes: false,
    message: 'Trop de tentatives, réessayez dans 15 minutes.'
  }
})


/* ===== ROUTE SANTÉ ===== */
/* Vérification de l'état du serveur (utilisée par Render) */
app.get('/api/health', function(req, res) {
  res.json({
    statut: 'ok',
    service: 'LearnWithUs API',
    heure: new Date()
  })
})


/* ===== SYNCHRONISATION CRM =====
   Cherche un contact dans le CRM par son email (retourne null si aucun). */
async function chercherContactCRM(email) {
  if (!NOTION_DS_CRM_ID) return null
  try {
    const reponse = await notion.dataSources.query({
      data_source_id: NOTION_DS_CRM_ID,
      filter: { property: 'Email', email: { equals: email } }
    })
    return reponse.results[0] || null
  } catch (e) {
    console.warn('Recherche CRM échouée : ' + e.message)
    return null
  }
}

/* Crée ou met à jour un contact dans le CRM Notion.
   Appelée depuis les routes /api/inscription, /api/creer-compte,
   /api/activer-premium et /api/contact pour alimenter le pipeline.
   Si l'email existe déjà : met à jour pipeline + dernière action.
   Sinon : crée une nouvelle entrée avec Pipeline="Lead" par défaut. */
async function synchroniserCRM(donnees) {
  if (!NOTION_DS_CRM_ID || !process.env.NOTION_TOKEN) return

  const { nomComplet, email, telephone, source, formation, pipeline } = donnees
  const aujourdhui = new Date().toISOString().slice(0, 10)

  try {
    const existant = await chercherContactCRM(email)

    if (existant) {
      /* Contact déjà présent : on met à jour pipeline + dernière action. */
      const maj = {
        'Dernière action': { date: { start: aujourdhui } }
      }
      if (pipeline)  maj['Pipeline']   = { select: { name: pipeline } }
      if (telephone) maj['Téléphone']  = { phone_number: telephone }

      await notion.pages.update({
        page_id: existant.id,
        properties: maj
      })
      console.log('🔄 CRM mis à jour : ' + email + (pipeline ? ' → ' + pipeline : ''))
    } else {
      /* Nouveau contact : création avec Pipeline="Lead" par défaut. */
      const props = {
        'Nom complet':      { title: [{ text: { content: nomComplet || email } }] },
        'Email':            { email: email },
        'Source':           { select: { name: source || 'Autre' } },
        'Pipeline':         { select: { name: pipeline || 'Lead' } },
        'Date 1er contact': { date: { start: aujourdhui } },
        'Dernière action':  { date: { start: aujourdhui } }
      }
      if (telephone) props['Téléphone']           = { phone_number: telephone }
      if (formation) props['Formation d\'intérêt'] = { select: { name: formation } }

      await notion.pages.create({
        parent: { data_source_id: NOTION_DS_CRM_ID },
        properties: props
      })
      console.log('➕ CRM : nouveau contact ' + email + ' (source : ' + (source || 'Autre') + ')')
    }
  } catch (e) {
    console.error('⚠️  Erreur sync CRM : ' + e.message)
  }
}


/* ===== ENREGISTREMENT TRANSACTION =====
   Enregistre une transaction dans la base Notion "Transactions".
   /!\ AUCUNE donnée bancaire n'est stockée : uniquement les métadonnées
   (email, montant, date, statut) pour respecter le RGPD et éviter la
   conformité PCI DSS (exigée pour qui stocke des numéros de carte).
   Dans un vrai SaaS, le numéro de carte n'arrive jamais sur le serveur :
   il est envoyé directement au prestataire (Stripe, Adyen) qui renvoie
   un token de transaction. */
async function enregistrerTransaction(donnees) {
  if (!NOTION_DS_TRANSACTIONS_ID || !process.env.NOTION_TOKEN) return null

  const { email, formation, montant, statut } = donnees
  const maintenant = new Date()
  const aujourdhui = maintenant.toISOString().slice(0, 10)
  /* Référence unique : TXN-YYYYMMDD-HHMMSS (lisible + triable) */
  const reference = 'TXN-' + aujourdhui.replace(/-/g, '') + '-' +
                    maintenant.toISOString().slice(11, 19).replace(/:/g, '')

  try {
    await notion.pages.create({
      parent: { data_source_id: NOTION_DS_TRANSACTIONS_ID },
      properties: {
        'Référence':    { title: [{ text: { content: reference } }] },
        'Email client': { email: email },
        'Formation':    { select: { name: formation || 'Premium global' } },
        'Montant':      { number: montant || 29 },
        'Date':         { date: { start: aujourdhui } },
        'Statut':       { select: { name: statut || 'Validé' } }
      }
    })
    console.log('💳 Transaction enregistrée : ' + reference + ' (' + email + ')')
    return reference
  } catch (e) {
    console.error('⚠️  Erreur enregistrement transaction : ' + e.message)
    return null
  }
}


/* Ancien endpoint POST /api/inscription (formulaire formations.html) supprimé :
   remplacé par le parcours unique "création de compte + formation d'intérêt"
   depuis /api/creer-compte. L'ancienne base Notion "Inscriptions Formations"
   est conservée pour archivage mais n'est plus alimentée. */


/* ===== ROUTE CONTACT ===== */
/* Reçoit un message du formulaire contact et le transmet à n8n
   qui envoie un accusé de réception à l'étudiant + notifie l'équipe */
app.post('/api/contact', async function(req, res) {

  const { prenom, nom, email, sujet, message } = req.body

  if (!prenom || !email || !message) {
    return res.status(400).json({
      succes: false,
      message: 'Prénom, email et message sont obligatoires'
    })
  }

  console.log('📩 Nouveau message de ' + email + ' — Sujet : ' + sujet)

  /* Transmet au webhook n8n dédié au formulaire contact
     (workflow n8n-workflow-contact.json) */
  const urlWebhookContact = process.env.WEBHOOK_N8N_CONTACT_URL
  if (urlWebhookContact) {
    try {
      await fetch(urlWebhookContact, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prenom, nom, email, sujet, message })
      })
      console.log('📨 Message transmis à n8n pour ' + email)
    } catch (erreur) {
      console.error('⚠️  Impossible de contacter n8n : ' + erreur.message)
    }
  }

  /* Ajout au CRM Notion (Pipeline="Lead", Source=Formulaire contact) */
  synchroniserCRM({
    nomComplet: (prenom + ' ' + (nom || '')).trim(),
    email:      email,
    source:     'Formulaire contact',
    pipeline:   'Lead'
  })

  res.json({
    succes: true,
    message: 'Votre message a bien été reçu. Réponse sous 24h.'
  })
})


/* ===== UTILITAIRES COMPTES ===== */
/* Cherche un compte dans la base Notion "Comptes LearnWithUs" par son email.
   Utilise dataSources.query (API Notion 2025-09-03) car databases.query
   a été supprimée dans @notionhq/client v5+.
   Retourne la page Notion trouvée ou null si aucun compte ne correspond. */
async function chercherCompteParEmail(email) {
  const reponse = await notion.dataSources.query({
    data_source_id: NOTION_DS_COMPTES_ID,
    filter: {
      property: 'Email',
      title: { equals: email }
    }
  })
  return reponse.results[0] || null
}

/* Extrait les champs d'un compte Notion sous forme d'objet simple */
function lireCompte(pageNotion) {
  const props = pageNotion.properties
  return {
    id:      pageNotion.id,
    email:   props['Email'].title[0]?.text?.content || '',
    hash:    props['Mot de passe'].rich_text[0]?.text?.content || '',
    prenom:  props['Prenom'].rich_text[0]?.text?.content || '',
    nom:     props['Nom'].rich_text[0]?.text?.content || '',
    statut:  props['Statut'].select?.name || 'Standard'
  }
}

/* Génère un jeton JWT valable 7 jours contenant les infos de l'utilisateur.
   Ajoute également le drapeau `estAdmin` (basé sur la liste ADMIN_EMAILS)
   directement sur l'objet utilisateur, qui est ensuite renvoyé au frontend. */
function genererJeton(utilisateur) {
  utilisateur.estAdmin = ADMIN_EMAILS.includes((utilisateur.email || '').toLowerCase())
  return jwt.sign(
    {
      email:    utilisateur.email,
      prenom:   utilisateur.prenom,
      nom:      utilisateur.nom,
      statut:   utilisateur.statut,
      estAdmin: utilisateur.estAdmin
    },
    JWT_SECRET,
    { expiresIn: '7d' }
  )
}


/* ===== ROUTE CRÉATION DE COMPTE ===== */
/* Crée un nouveau compte dans Notion avec mot de passe hashé (bcrypt)
   puis renvoie un jeton JWT pour connecter automatiquement l'utilisateur */
app.post('/api/creer-compte', limiteurAuth, async function(req, res) {

  const { prenom, nom, email, motDePasse, telephone, formation } = req.body

  if (!prenom || !nom || !email || !motDePasse) {
    return res.status(400).json({
      succes: false,
      message: 'Prénom, nom, email et mot de passe sont obligatoires'
    })
  }

  if (motDePasse.length < 8) {
    return res.status(400).json({
      succes: false,
      message: 'Le mot de passe doit faire au moins 8 caractères'
    })
  }

  if (!NOTION_DATABASE_COMPTES_ID || !NOTION_DS_COMPTES_ID || !process.env.NOTION_TOKEN) {
    return res.status(500).json({
      succes: false,
      message: 'Base de comptes non configurée sur le serveur'
    })
  }

  try {
    /* Vérifie qu'aucun compte n'existe déjà avec cet email */
    const compteExistant = await chercherCompteParEmail(email)
    if (compteExistant) {
      return res.status(409).json({
        succes: false,
        message: 'Un compte existe déjà avec cet email'
      })
    }

    /* Hash du mot de passe avec bcrypt (10 rounds = bon équilibre) */
    const motDePasseHashe = await bcrypt.hash(motDePasse, 10)

    /* Création de la page dans la base Notion Comptes */
    await notion.pages.create({
      parent: { database_id: NOTION_DATABASE_COMPTES_ID },
      properties: {
        'Email':        { title: [{ text: { content: email } }] },
        'Mot de passe': { rich_text: [{ text: { content: motDePasseHashe } }] },
        'Prenom':       { rich_text: [{ text: { content: prenom } }] },
        'Nom':          { rich_text: [{ text: { content: nom } }] },
        'Statut':       { select: { name: 'Standard' } }
      }
    })

    console.log('👤 Nouveau compte créé : ' + email)

    /* Ajout au CRM Notion (Pipeline="Lead", Source=Création compte)
       avec éventuelles infos optionnelles (téléphone + formation d'intérêt) */
    synchroniserCRM({
      nomComplet: prenom + ' ' + nom,
      email:      email,
      telephone:  telephone || undefined,
      formation:  formation || undefined,
      source:     'Création compte',
      pipeline:   'Lead'
    })

    /* Email de bienvenue via n8n (workflow #1, ex-inscription, recyclé)
       si l'URL du webhook est configurée. Fire-and-forget.
       On embarque un lien de vérification d'email (JWT signé, 7 jours). */
    const urlWebhookBienvenue = process.env.WEBHOOK_N8N_URL
    if (urlWebhookBienvenue) {
      const tokenVerif = jwt.sign(
        { email, purpose: 'verification' },
        JWT_SECRET,
        { expiresIn: '7d' }
      )
      const FRONT_URL = process.env.URL_FRONTEND || 'https://learn-with-us-lac.vercel.app'
      const lienVerif = FRONT_URL + '/verification-email.html?token=' + tokenVerif

      fetch(urlWebhookBienvenue, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prenom, nom, email,
          formation: formation || '',
          lienVerification: lienVerif
        })
      }).catch(e => console.error('⚠️  n8n bienvenue : ' + e.message))
    }

    /* Génère un jeton pour connecter automatiquement l'utilisateur */
    const utilisateur = { email, prenom, nom, statut: 'Standard' }
    const token = genererJeton(utilisateur)

    res.json({
      succes: true,
      message: 'Compte créé avec succès',
      token:   token,
      utilisateur: utilisateur
    })

  } catch (erreur) {
    console.error('⚠️  Erreur création compte : ' + erreur.message)
    console.error(erreur)
    res.status(500).json({
      succes: false,
      message: 'Erreur serveur lors de la création du compte',
      detail: erreur.message,
      code:   erreur.code
    })
  }
})


/* ===== MIDDLEWARE JWT ===== */
/* Vérifie le jeton JWT présent dans l'en-tête "Authorization: Bearer <token>".
   Si valide, attache les infos utilisateur à req.utilisateur et passe la main. */
function verifierJeton(req, res, next) {
  const entete = req.headers.authorization
  if (!entete || !entete.startsWith('Bearer ')) {
    return res.status(401).json({
      succes: false,
      message: 'Authentification requise'
    })
  }

  const token = entete.substring(7)
  try {
    req.utilisateur = jwt.verify(token, JWT_SECRET)
    next()
  } catch (erreur) {
    return res.status(401).json({
      succes: false,
      message: 'Session expirée, veuillez vous reconnecter'
    })
  }
}


/* ===== ROUTE CONNEXION ===== */
/* Vérifie email + mot de passe puis renvoie un jeton JWT si correct */
app.post('/api/connexion', limiteurAuth, async function(req, res) {

  const { email, motDePasse } = req.body

  if (!email || !motDePasse) {
    return res.status(400).json({
      succes: false,
      message: 'Email et mot de passe obligatoires'
    })
  }

  try {
    const pageCompte = await chercherCompteParEmail(email)
    if (!pageCompte) {
      return res.status(401).json({
        succes: false,
        message: 'Email ou mot de passe incorrect'
      })
    }

    const compte = lireCompte(pageCompte)

    /* Compare le mot de passe fourni au hash stocké */
    const motDePasseValide = await bcrypt.compare(motDePasse, compte.hash)
    if (!motDePasseValide) {
      return res.status(401).json({
        succes: false,
        message: 'Email ou mot de passe incorrect'
      })
    }

    /* Met à jour la date de dernière connexion (silencieux si erreur) */
    try {
      await notion.pages.update({
        page_id: compte.id,
        properties: {
          'Derniere connexion': { date: { start: new Date().toISOString() } }
        }
      })
    } catch (e) {
      console.warn('Maj dernière connexion échouée : ' + e.message)
    }

    console.log('🔑 Connexion réussie : ' + email)

    const utilisateur = {
      email:  compte.email,
      prenom: compte.prenom,
      nom:    compte.nom,
      statut: compte.statut
    }
    const token = genererJeton(utilisateur)

    res.json({
      succes: true,
      message: 'Connexion réussie',
      token:   token,
      utilisateur: utilisateur
    })

  } catch (erreur) {
    console.error('⚠️  Erreur connexion : ' + erreur.message)
    res.status(500).json({
      succes: false,
      message: 'Erreur serveur lors de la connexion'
    })
  }
})


/* ===== ROUTE ACTIVATION PREMIUM ===== */
/* Bascule le statut du compte connecté de "Standard" à "Premium".
   Appelée après le formulaire de paiement fictif (pas de vrai Stripe).
   Renvoie un nouveau JWT avec le statut Premium pour mettre à jour la session. */
app.post('/api/activer-premium', verifierJeton, async function(req, res) {

  const email = req.utilisateur.email

  try {
    const pageCompte = await chercherCompteParEmail(email)
    if (!pageCompte) {
      return res.status(404).json({
        succes: false,
        message: 'Compte introuvable'
      })
    }

    /* Met à jour le statut dans Notion */
    await notion.pages.update({
      page_id: pageCompte.id,
      properties: {
        'Statut': { select: { name: 'Premium' } }
      }
    })

    console.log('⭐ Passage Premium : ' + email)

    /* Mise à jour CRM : bascule Pipeline vers "Client Premium" */
    synchroniserCRM({
      email:    email,
      source:   'Paiement Premium',
      pipeline: 'Client Premium'
    })

    /* Enregistre la transaction dans Notion (sans donnée bancaire).
       Le montant 29 € correspond au prix affiché sur paiement.html. */
    const reference = await enregistrerTransaction({
      email:     email,
      formation: 'Premium global',
      montant:   29,
      statut:    'Validé'
    })

    /* Transmet au webhook n8n #4 (paiement) pour l'envoi du reçu
       à l'étudiant et de la notification à l'équipe */
    const urlWebhookPaiement = process.env.WEBHOOK_N8N_PAIEMENT_URL
    if (urlWebhookPaiement) {
      const compteInfo = lireCompte(pageCompte)
      fetch(urlWebhookPaiement, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email:     email,
          prenom:    compteInfo.prenom,
          nom:       compteInfo.nom,
          reference: reference,
          montant:   29,
          formation: 'Premium global',
          date:      new Date().toISOString().slice(0, 10)
        })
      }).catch(e => console.error('⚠️  n8n paiement : ' + e.message))
    }

    /* Génère un nouveau jeton avec le statut mis à jour */
    const compte = lireCompte(pageCompte)
    const utilisateur = {
      email:  compte.email,
      prenom: compte.prenom,
      nom:    compte.nom,
      statut: 'Premium'
    }
    const token = genererJeton(utilisateur)

    res.json({
      succes: true,
      message: 'Abonnement Premium activé avec succès',
      token:   token,
      utilisateur: utilisateur
    })

  } catch (erreur) {
    console.error('⚠️  Erreur activation Premium : ' + erreur.message)
    res.status(500).json({
      succes: false,
      message: 'Erreur lors de l\'activation de l\'abonnement'
    })
  }
})


/* ===== MIDDLEWARE ADMIN =====
   Vérifie que l'utilisateur connecté (via JWT) est dans la liste
   ADMIN_EMAILS. À utiliser APRÈS verifierJeton. */
function verifierAdmin(req, res, next) {
  const email = (req.utilisateur.email || '').toLowerCase()
  if (ADMIN_EMAILS.length === 0 || !ADMIN_EMAILS.includes(email)) {
    return res.status(403).json({
      succes: false,
      message: 'Accès réservé à l\'équipe administration'
    })
  }
  next()
}


/* ===== UTILITAIRE ADMIN =====
   Liste toutes les pages d'une data source Notion (paginé en interne).
   Pour un projet école on suppose moins de 1000 pages par base. */
async function listerPages(dataSourceId) {
  if (!dataSourceId) return []
  const toutes = []
  let cursor = undefined
  do {
    const requete = { data_source_id: dataSourceId, page_size: 100 }
    if (cursor) requete.start_cursor = cursor
    const reponse = await notion.dataSources.query(requete)
    toutes.push(...reponse.results)
    cursor = reponse.has_more ? reponse.next_cursor : undefined
  } while (cursor)
  return toutes
}


/* ===== ROUTE DASHBOARD ADMIN =====
   Agrège les chiffres clés des 4 bases Notion (Inscriptions, Comptes,
   CRM, Transactions) pour alimenter le dashboard admin.html. */
app.get('/api/admin/stats', verifierJeton, verifierAdmin, async function(req, res) {

  try {
    /* Récupération des 4 bases en parallèle pour gagner du temps */
    const [inscriptions, comptes, crm, transactions] = await Promise.all([
      listerPages(NOTION_DS_INSCRIPTIONS_ID),
      listerPages(NOTION_DS_COMPTES_ID),
      listerPages(NOTION_DS_CRM_ID),
      listerPages(NOTION_DS_TRANSACTIONS_ID)
    ])

    /* Tri par date de création décroissante (plus récentes en premier) */
    const triRecent = (a, b) => new Date(b.created_time) - new Date(a.created_time)
    inscriptions.sort(triRecent)
    comptes.sort(triRecent)
    crm.sort(triRecent)
    transactions.sort(triRecent)

    /* Comptes : répartition Standard / Premium */
    const comptesParStatut = { Standard: 0, Premium: 0 }
    comptes.forEach(c => {
      const statut = c.properties?.Statut?.select?.name
      if (statut === 'Premium') comptesParStatut.Premium++
      else comptesParStatut.Standard++
    })

    /* CRM : répartition par formation d'intérêt (remplace les inscriptions
       par formation depuis la bascule vers le parcours compte unique) */
    const crmParFormation = { IA: 0, SCRUM: 0, SAP: 0 }
    crm.forEach(c => {
      const f = c.properties?.['Formation d\'intérêt']?.select?.name
      if (f && crmParFormation[f] !== undefined) crmParFormation[f]++
    })

    /* CRM : répartition par étape de pipeline */
    const leadsParPipeline = {
      'Lead':            0,
      'Contacté':        0,
      'Client Standard': 0,
      'Client Premium':  0,
      'Perdu':           0
    }
    crm.forEach(l => {
      const p = l.properties?.Pipeline?.select?.name
      if (p && leadsParPipeline[p] !== undefined) leadsParPipeline[p]++
    })

    /* Transactions : revenu total (somme des montants validés) */
    const totalRevenu = transactions.reduce((somme, t) => {
      const statut = t.properties?.Statut?.select?.name
      if (statut !== 'Validé') return somme
      return somme + (t.properties?.Montant?.number || 0)
    }, 0)

    /* 5 dernières inscriptions (format allégé pour l'affichage) */
    const dernieresInscriptions = inscriptions.slice(0, 5).map(p => ({
      prenom:    p.properties?.Prénom?.title?.[0]?.text?.content || '',
      nom:       p.properties?.Nom?.rich_text?.[0]?.text?.content || '',
      email:     p.properties?.Email?.email || '',
      formation: p.properties?.Formation?.select?.name || '',
      date:      p.created_time
    }))

    /* 5 dernières transactions (format allégé pour l'affichage) */
    const dernieresTransactions = transactions.slice(0, 5).map(t => ({
      reference: t.properties?.Référence?.title?.[0]?.text?.content || '',
      email:     t.properties?.['Email client']?.email || '',
      formation: t.properties?.Formation?.select?.name || '',
      montant:   t.properties?.Montant?.number || 0,
      statut:    t.properties?.Statut?.select?.name || '',
      date:      t.created_time
    }))

    /* Liste complète des comptes pour la section "Gestion des comptes"
       du dashboard admin (delete + changement de statut) */
    const tousLesComptes = comptes.map(c => ({
      email:  c.properties?.Email?.title?.[0]?.text?.content || '',
      prenom: c.properties?.Prenom?.rich_text?.[0]?.text?.content || '',
      nom:    c.properties?.Nom?.rich_text?.[0]?.text?.content || '',
      statut: c.properties?.Statut?.select?.name || 'Standard',
      date:   c.created_time
    }))

    res.json({
      succes: true,
      stats: {
        totalInscriptions:      inscriptions.length,
        totalComptes:           comptes.length,
        totalLeads:             crm.length,
        totalTransactions:      transactions.length,
        totalRevenu:            totalRevenu,
        comptesParStatut:       comptesParStatut,
        crmParFormation:        crmParFormation,
        leadsParPipeline:       leadsParPipeline,
        dernieresInscriptions:  dernieresInscriptions,
        dernieresTransactions:  dernieresTransactions,
        tousLesComptes:         tousLesComptes
      }
    })

  } catch (erreur) {
    console.error('⚠️  Erreur /api/admin/stats : ' + erreur.message)
    res.status(500).json({
      succes: false,
      message: 'Erreur lors du chargement des statistiques'
    })
  }
})


/* ===== ROUTE SUPPRESSION COMPTE (utilisateur) =====
   Permet à un utilisateur connecté de supprimer son propre compte
   (droit à l'effacement RGPD). La page Notion est archivée (soft delete)
   pour garder une trace technique. Le CRM n'est pas modifié : on conserve
   l'historique du lead pour la comptabilité. */
app.delete('/api/compte', verifierJeton, async function(req, res) {

  const email = req.utilisateur.email

  try {
    const pageCompte = await chercherCompteParEmail(email)
    if (!pageCompte) {
      return res.status(404).json({
        succes: false,
        message: 'Compte introuvable'
      })
    }

    await notion.pages.update({
      page_id:  pageCompte.id,
      archived: true
    })

    console.log('🗑️  Compte supprimé : ' + email)

    res.json({
      succes: true,
      message: 'Votre compte a bien été supprimé'
    })

  } catch (erreur) {
    console.error('⚠️  Erreur suppression compte : ' + erreur.message)
    res.status(500).json({
      succes: false,
      message: 'Erreur lors de la suppression du compte'
    })
  }
})


/* ===== ROUTE ADMIN : SUPPRIMER UN COMPTE =====
   Permet à un admin d'archiver le compte de n'importe quel utilisateur
   (sauf le sien, par sécurité : un admin doit utiliser /api/compte). */
app.delete('/api/admin/comptes/:email', verifierJeton, verifierAdmin, async function(req, res) {

  const emailCible    = decodeURIComponent(req.params.email).toLowerCase()
  const emailAdmin    = req.utilisateur.email.toLowerCase()

  if (emailCible === emailAdmin) {
    return res.status(400).json({
      succes: false,
      message: 'Vous ne pouvez pas supprimer votre propre compte via cette route'
    })
  }

  try {
    const pageCompte = await chercherCompteParEmail(emailCible)
    if (!pageCompte) {
      return res.status(404).json({
        succes: false,
        message: 'Compte introuvable'
      })
    }

    await notion.pages.update({
      page_id:  pageCompte.id,
      archived: true
    })

    console.log('🗑️  [Admin ' + emailAdmin + '] Compte supprimé : ' + emailCible)

    res.json({
      succes: true,
      message: 'Compte de ' + emailCible + ' supprimé'
    })

  } catch (erreur) {
    console.error('⚠️  Erreur suppression admin : ' + erreur.message)
    res.status(500).json({
      succes: false,
      message: 'Erreur lors de la suppression'
    })
  }
})


/* ===== ROUTE ADMIN : CHANGER LE STATUT D'UN COMPTE =====
   Permet de basculer manuellement Standard ↔ Premium (ex : geste
   commercial, résiliation anticipée). Ne déclenche aucun webhook. */
app.put('/api/admin/comptes/:email/statut', verifierJeton, verifierAdmin, async function(req, res) {

  const emailCible     = decodeURIComponent(req.params.email).toLowerCase()
  const { nouveauStatut } = req.body

  if (!['Standard', 'Premium'].includes(nouveauStatut)) {
    return res.status(400).json({
      succes: false,
      message: 'Statut invalide (attendu : Standard ou Premium)'
    })
  }

  try {
    const pageCompte = await chercherCompteParEmail(emailCible)
    if (!pageCompte) {
      return res.status(404).json({
        succes: false,
        message: 'Compte introuvable'
      })
    }

    await notion.pages.update({
      page_id: pageCompte.id,
      properties: {
        'Statut': { select: { name: nouveauStatut } }
      }
    })

    console.log('🔁 [Admin] Statut de ' + emailCible + ' → ' + nouveauStatut)

    res.json({
      succes: true,
      message: 'Statut mis à jour : ' + nouveauStatut
    })

  } catch (erreur) {
    console.error('⚠️  Erreur changement statut : ' + erreur.message)
    res.status(500).json({
      succes: false,
      message: 'Erreur lors du changement de statut'
    })
  }
})


/* ===== URL DU FRONT POUR CONSTRUIRE LES LIENS EMAIL =====
   Utilisée par les emails de reset mot de passe et de vérification :
   le backend doit embarquer un lien vers la bonne page frontend. */
const URL_FRONT = process.env.URL_FRONTEND || 'https://learn-with-us-lac.vercel.app'


/* ===== ROUTE DEMANDE DE RESET MOT DE PASSE =====
   Génère un JWT dédié "purpose=reset" valable 15 minutes, appelle le
   webhook n8n #5 (reset-mdp) pour envoyer le mail, et renvoie toujours
   un succès (même si l'email n'existe pas) pour éviter l'énumération. */
app.post('/api/mdp/demande', limiteurAuth, async function(req, res) {

  const { email } = req.body
  if (!email) {
    return res.status(400).json({ succes: false, message: 'Email obligatoire' })
  }

  try {
    const pageCompte = await chercherCompteParEmail(email)

    if (pageCompte) {
      const compte = lireCompte(pageCompte)

      /* Le token de reset est un JWT signé avec le même secret que
         les tokens de session — on le distingue via purpose='reset' */
      const tokenReset = jwt.sign(
        { email: compte.email, purpose: 'reset' },
        JWT_SECRET,
        { expiresIn: '15m' }
      )
      const lienReset = URL_FRONT + '/reset-mot-de-passe.html?token=' + tokenReset

      const urlWebhook = process.env.WEBHOOK_N8N_RESET_URL
      if (urlWebhook) {
        fetch(urlWebhook, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email:  compte.email,
            prenom: compte.prenom,
            lien:   lienReset
          })
        }).catch(e => console.error('⚠️  n8n reset : ' + e.message))
      } else {
        /* Pas de webhook configuré : on log le lien côté serveur pour
           permettre le test en dev sans dépendre de n8n. */
        console.log('🔑 [RESET] ' + compte.email + ' → ' + lienReset)
      }
    }

    /* Réponse volontairement générique pour ne pas révéler si l'email
       existe ou non (protection contre l'énumération) */
    res.json({
      succes: true,
      message: 'Si un compte existe avec cet email, un lien de réinitialisation vient de partir.'
    })

  } catch (erreur) {
    console.error('⚠️  Erreur reset demande : ' + erreur.message)
    res.status(500).json({ succes: false, message: 'Erreur serveur' })
  }
})


/* ===== ROUTE CONFIRMATION DU RESET =====
   Prend le JWT reçu par email + le nouveau mot de passe, vérifie le
   token (expiration + purpose) et met à jour le hash bcrypt dans Notion. */
app.post('/api/mdp/confirmer', async function(req, res) {

  const { token, nouveauMdp } = req.body
  if (!token || !nouveauMdp) {
    return res.status(400).json({ succes: false, message: 'Token et nouveau mot de passe obligatoires' })
  }
  if (nouveauMdp.length < 8) {
    return res.status(400).json({ succes: false, message: 'Mot de passe trop court (8 caractères min)' })
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET)
    if (payload.purpose !== 'reset') {
      return res.status(400).json({ succes: false, message: 'Token invalide' })
    }

    const pageCompte = await chercherCompteParEmail(payload.email)
    if (!pageCompte) {
      return res.status(404).json({ succes: false, message: 'Compte introuvable' })
    }

    const nouveauHash = await bcrypt.hash(nouveauMdp, 10)
    await notion.pages.update({
      page_id: pageCompte.id,
      properties: {
        'Mot de passe': { rich_text: [{ text: { content: nouveauHash } }] }
      }
    })

    console.log('🔑 Mot de passe réinitialisé : ' + payload.email)

    res.json({ succes: true, message: 'Mot de passe réinitialisé' })

  } catch (erreur) {
    if (erreur.name === 'TokenExpiredError') {
      return res.status(400).json({ succes: false, message: 'Lien expiré (valable 15 minutes). Relancez une demande.' })
    }
    console.error('⚠️  Erreur reset confirmer : ' + erreur.message)
    res.status(400).json({ succes: false, message: 'Lien invalide' })
  }
})


/* ===== ROUTE VÉRIFICATION EMAIL =====
   Confirme qu'un visiteur a bien cliqué sur le lien reçu à la création
   de compte. Pour un projet école, on ne stocke pas l'état vérifié
   (on ne bloque aucune fonctionnalité dessus) mais on valide la
   signature JWT et on log le succès : cela suffit à démontrer la
   démarche de vérification. */
app.get('/api/verifier-email/:token', async function(req, res) {

  const token = req.params.token
  try {
    const payload = jwt.verify(token, JWT_SECRET)
    if (payload.purpose !== 'verification') {
      return res.status(400).json({ succes: false, message: 'Token invalide' })
    }
    console.log('✉️  Email vérifié : ' + payload.email)
    res.json({ succes: true, email: payload.email })
  } catch (erreur) {
    if (erreur.name === 'TokenExpiredError') {
      return res.status(400).json({ succes: false, message: 'Lien de vérification expiré' })
    }
    res.status(400).json({ succes: false, message: 'Lien invalide' })
  }
})


/* ===== DÉMARRAGE ===== */
const PORT = process.env.PORT || 3000
app.listen(PORT, function() {
  console.log('🚀 Serveur LearnWithUs démarré sur le port ' + PORT)
  console.log('   → Santé : http://localhost:' + PORT + '/api/health')
})
