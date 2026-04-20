/* server.js — Serveur backend de LearnWithUs
   Lance le serveur : npm run dev (dev) ou npm start (prod) */

const express  = require('express')
const cors     = require('cors')
const dotenv   = require('dotenv')
const bcrypt   = require('bcryptjs')
const jwt      = require('jsonwebtoken')
const { Client } = require('@notionhq/client')

dotenv.config()

/* Client Notion initialisé avec le token d'intégration */
const notion = new Client({ auth: process.env.NOTION_TOKEN })
const NOTION_DATABASE_ID           = process.env.NOTION_DATABASE_ID
const NOTION_DATABASE_COMPTES_ID   = process.env.NOTION_DATABASE_COMPTES_ID
/* Data source ID de la base "Comptes LearnWithUs" — requis pour les
   requêtes (notion.dataSources.query dans le SDK @notionhq/client v5+) */
const NOTION_DS_COMPTES_ID         = process.env.NOTION_DS_COMPTES_ID
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


/* ===== ROUTE SANTÉ ===== */
/* Vérification de l'état du serveur (utilisée par Render) */
app.get('/api/health', function(req, res) {
  res.json({
    statut: 'ok',
    service: 'LearnWithUs API',
    heure: new Date()
  })
})


/* ===== ROUTE INSCRIPTION ===== */
/* Reçoit une inscription, la sauvegarde dans Notion et notifie n8n */
app.post('/api/inscription', async function(req, res) {

  const { prenom, nom, email, formation, telephone } = req.body

  if (!prenom || !nom || !email || !formation) {
    return res.status(400).json({
      succes: false,
      message: 'Champs obligatoires manquants : prénom, nom, email, formation'
    })
  }

  console.log('✅ Nouvelle inscription : ' + prenom + ' ' + nom + ' → Formation : ' + formation)

  /* Sauvegarde dans Notion si les variables d'environnement sont configurées */
  if (NOTION_DATABASE_ID && process.env.NOTION_TOKEN) {
    try {
      await notion.pages.create({
        parent: { database_id: NOTION_DATABASE_ID },
        properties: {
          'Prénom':    { title: [{ text: { content: prenom } }] },
          'Nom':       { rich_text: [{ text: { content: nom } }] },
          'Email':     { email: email },
          'Formation': { select: { name: formation } },
          'Téléphone': { phone_number: telephone || null },
          'Statut':    { select: { name: 'Nouveau' } }
        }
      })
      console.log('📋 Inscription sauvegardée dans Notion pour ' + email)
    } catch (erreurNotion) {
      console.error('⚠️  Erreur Notion : ' + erreurNotion.message)
    }
  }

  /* Transmet au webhook n8n pour l'envoi des emails automatiques */
  const urlWebhookN8n = process.env.WEBHOOK_N8N_URL
  if (urlWebhookN8n) {
    try {
      await fetch(urlWebhookN8n, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prenom, nom, email, formation, telephone })
      })
      console.log('📨 Données transmises à n8n pour ' + email)
    } catch (erreur) {
      console.error('⚠️  Impossible de contacter n8n : ' + erreur.message)
    }
  }

  res.json({
    succes: true,
    message: 'Inscription de ' + prenom + ' enregistrée avec succès'
  })
})


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

/* Génère un jeton JWT valable 7 jours contenant les infos de l'utilisateur */
function genererJeton(utilisateur) {
  return jwt.sign(
    {
      email:  utilisateur.email,
      prenom: utilisateur.prenom,
      nom:    utilisateur.nom,
      statut: utilisateur.statut
    },
    JWT_SECRET,
    { expiresIn: '7d' }
  )
}


/* ===== ROUTE CRÉATION DE COMPTE ===== */
/* Crée un nouveau compte dans Notion avec mot de passe hashé (bcrypt)
   puis renvoie un jeton JWT pour connecter automatiquement l'utilisateur */
app.post('/api/creer-compte', async function(req, res) {

  const { prenom, nom, email, motDePasse } = req.body

  if (!prenom || !nom || !email || !motDePasse) {
    return res.status(400).json({
      succes: false,
      message: 'Tous les champs sont obligatoires'
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


/* ===== ROUTE CONNEXION ===== */
/* Vérifie email + mot de passe puis renvoie un jeton JWT si correct */
app.post('/api/connexion', async function(req, res) {

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


/* ===== DÉMARRAGE ===== */
const PORT = process.env.PORT || 3000
app.listen(PORT, function() {
  console.log('🚀 Serveur LearnWithUs démarré sur le port ' + PORT)
  console.log('   → Santé : http://localhost:' + PORT + '/api/health')
})
