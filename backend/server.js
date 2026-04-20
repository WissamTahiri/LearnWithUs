/* server.js — Serveur backend de LearnWithUs
   Lance le serveur : npm run dev (dev) ou npm start (prod) */

const express  = require('express')
const cors     = require('cors')
const dotenv   = require('dotenv')
const { Client } = require('@notionhq/client')

dotenv.config()

/* Client Notion initialisé avec le token d'intégration */
const notion = new Client({ auth: process.env.NOTION_TOKEN })
const NOTION_DATABASE_ID = process.env.NOTION_DATABASE_ID

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
/* Reçoit un message de contact et confirme la réception */
app.post('/api/contact', function(req, res) {

  const { prenom, nom, email, sujet, message } = req.body

  if (!prenom || !email || !message) {
    return res.status(400).json({
      succes: false,
      message: 'Prénom, email et message sont obligatoires'
    })
  }

  console.log('📩 Nouveau message de ' + email + ' — Sujet : ' + sujet)

  res.json({
    succes: true,
    message: 'Votre message a bien été reçu. Réponse sous 24h.'
  })
})


/* ===== DÉMARRAGE ===== */
const PORT = process.env.PORT || 3000
app.listen(PORT, function() {
  console.log('🚀 Serveur LearnWithUs démarré sur le port ' + PORT)
  console.log('   → Santé : http://localhost:' + PORT + '/api/health')
})
