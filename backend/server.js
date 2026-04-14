/* ============================================================
   server.js — Serveur backend de LearnWithUs
   ============================================================
   Ce fichier crée un serveur web avec Express.js.
   Il reçoit les données du site (inscriptions, messages de contact)
   et les transmet à n8n pour l'automatisation des emails.

   Pour lancer le serveur :
     - En développement : npm run dev  (redémarre automatiquement)
     - En production    : npm start     (ou : node server.js)

   Le serveur écoute sur le port 3000 par défaut.
   En production (Render), le port est défini automatiquement.
   ============================================================ */


/* ============================================================
   CHARGEMENT DES MODULES
   ============================================================
   'require' importe un module Node.js.
   C'est l'équivalent de 'import' en JavaScript moderne (ES6).
   Node.js utilise require() car c'est le système historique
   de modules côté serveur (CommonJS).

   Chaque module ajoute des fonctionnalités à notre serveur :
   ============================================================ */

/* Express est un FRAMEWORK WEB pour Node.js.
   Il simplifie la création de serveurs HTTP.
   Sans Express, on devrait écrire beaucoup plus de code
   pour gérer les routes, les requêtes et les réponses. */
const express = require('express')

/* CORS (Cross-Origin Resource Sharing) autorise notre FRONTEND
   (hébergé sur Vercel, ex: learnnwithus.vercel.app) à appeler
   notre BACKEND (hébergé sur Render, ex: learnnwithus.onrender.com).
   Par sécurité, les navigateurs BLOQUENT les requêtes entre
   domaines différents. Le module cors lève cette restriction. */
const cors = require('cors')

/* dotenv lit le fichier .env à la racine du projet et charge
   les variables d'environnement dans process.env.
   C'est ainsi qu'on stocke des secrets (clés API, URLs privées)
   sans les écrire en dur dans le code (et sans les publier sur GitHub). */
const dotenv = require('dotenv')


/* ============================================================
   CONFIGURATION
   ============================================================ */

/* Charge le fichier .env s'il existe.
   Après cette ligne, on peut accéder aux variables avec
   process.env.NOM_VARIABLE (ex: process.env.WEBHOOK_N8N_URL).
   Si le fichier .env n'existe pas, rien ne se passe (pas d'erreur). */
dotenv.config()

/* Crée l'application Express.
   'app' est notre serveur — on va lui ajouter des routes
   (les URLs qu'il sait gérer) et des middleware (fonctions
   qui s'exécutent avant chaque route). */
const app = express()


/* ============================================================
   MIDDLEWARE
   ============================================================
   Un MIDDLEWARE est une fonction qui s'exécute AVANT chaque
   route (chaque requête). C'est comme un filtre ou un gardien.

   app.use() enregistre un middleware global : il s'applique
   à TOUTES les requêtes, quelle que soit l'URL.

   L'ordre des middleware est IMPORTANT : ils s'exécutent
   dans l'ordre où ils sont déclarés.
   ============================================================ */

/* cors() autorise les requêtes provenant d'autres domaines.
   Sans ce middleware, le navigateur bloquerait les appels
   du frontend (Vercel) vers le backend (Railway) car ils
   sont sur des domaines différents.
   On liste explicitement les origines autorisées pour plus
   de sécurité (plutôt que d'autoriser tout le monde). */
const originesAutorisées = [
  'http://localhost:5500',              /* Live Server en développement */
  'http://localhost:3000',              /* Autre port local possible */
  'https://learn-with-us-lac.vercel.app' /* Frontend Vercel en production */
]
app.use(cors({
  origin: originesAutorisées,
  methods: ['GET', 'POST']
}))

/* express.json() est un middleware qui ANALYSE le corps (body)
   des requêtes POST entrantes quand elles sont au format JSON.
   Sans lui, req.body serait undefined et on ne pourrait pas
   lire les données envoyées par les formulaires du site.
   Il convertit le texte JSON en objet JavaScript automatiquement. */
app.use(express.json())


/* ============================================================
   ROUTE DE SANTÉ (Health Check)
   ============================================================
   Render (notre hébergeur) appelle cette route régulièrement
   pour vérifier que le serveur est en vie ("health check").
   Si cette route répond 200 (OK), tout va bien.
   Si elle ne répond pas, Render redémarre automatiquement le serveur.

   app.get() crée une route pour les requêtes GET
   (les requêtes classiques du navigateur / vérification).
   ============================================================ */
app.get('/api/health', function(req, res) {
  /* req = la requête entrante (ce que le client envoie)
     res = la réponse sortante (ce qu'on renvoie au client)
     res.json() envoie une réponse au format JSON avec le
     code HTTP 200 (OK) par défaut. */
  res.json({
    statut: 'ok',
    service: 'LearnWithUs API',
    heure: new Date()
  })
})


/* ============================================================
   ROUTE INSCRIPTION
   ============================================================
   Reçoit les données du formulaire d'inscription du site web.
   Valide les données, les affiche dans les logs, puis les
   transmet au webhook n8n pour l'automatisation des emails.

   app.post() crée une route pour les requêtes POST
   (les requêtes qui ENVOIENT des données, comme un formulaire).

   Le mot-clé 'async' permet d'utiliser 'await' dans la fonction
   pour attendre la réponse de n8n sans bloquer le serveur.
   ============================================================ */
app.post('/api/inscription', async function(req, res) {

  /* Récupère les données envoyées par le formulaire.
     req.body contient le JSON envoyé par le frontend (via fetch).
     On utilise la DÉSTRUCTURATION pour extraire chaque champ
     directement dans une variable séparée.
     C'est équivalent à :
       const prenom = req.body.prenom
       const nom = req.body.nom
       etc. */
  const { prenom, nom, email, formation, telephone } = req.body

  /* Validation : vérifie que les champs obligatoires sont présents.
     L'opérateur ! (NOT) transforme une valeur en booléen inversé :
       !""    → true  (chaîne vide = falsy → inversé = true)
       !"Ali" → false (chaîne non vide = truthy → inversé = false)
     Si un champ obligatoire est vide, on répond avec une erreur.

     Le code HTTP 400 signifie "Bad Request" (mauvaise requête) :
     le client a envoyé des données incorrectes ou incomplètes. */
  if (!prenom || !nom || !email || !formation) {
    return res.status(400).json({
      succes: false,
      message:
        'Champs obligatoires manquants : ' +
        'prénom, nom, email, formation'
    })
  }

  /* Affiche dans la console du serveur pour le suivi.
     En production (Render), ces logs sont visibles dans
     le tableau de bord → onglet "Logs". */
  console.log(
    '✅ Nouvelle inscription : ' +
    prenom + ' ' + nom +
    ' → Formation : ' + formation
  )

  /* Transmet au webhook n8n si l'URL est configurée.
     process.env.WEBHOOK_N8N_URL lit la variable d'environnement
     définie dans le fichier .env (ou dans Render en production). */
  const urlWebhookN8n = process.env.WEBHOOK_N8N_URL

  if (urlWebhookN8n) {
    try {
      /* On retransmet les mêmes données vers n8n.
         n8n se chargera d'envoyer l'email de confirmation
         à l'utilisateur, d'ajouter l'entrée dans Airtable, etc.
         fetch() est disponible nativement dans Node.js 18+. */
      await fetch(urlWebhookN8n, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prenom, nom, email, formation, telephone
        })
      })
      console.log('📨 Données transmises à n8n pour ' + email)
    } catch (erreur) {
      /* Si n8n est inaccessible, on log l'erreur mais on ne
         bloque PAS l'inscription. L'utilisateur reçoit quand
         même sa confirmation. Le message n8n pourra être
         renvoyé manuellement plus tard. */
      console.error(
        '⚠️  Impossible de contacter n8n : ' + erreur.message
      )
    }
  }

  /* Répond au frontend que tout s'est bien passé.
     Le code HTTP 200 (par défaut avec res.json) signifie "OK". */
  res.json({
    succes: true,
    message:
      'Inscription de ' + prenom + ' enregistrée avec succès'
  })
})


/* ============================================================
   ROUTE CONTACT
   ============================================================
   Reçoit les données du formulaire de contact.
   Pour l'instant, on log le message et on confirme la réception.
   Plus tard, on pourra aussi transmettre à n8n pour envoyer
   un email de notification à l'équipe.
   ============================================================ */
app.post('/api/contact', function(req, res) {

  const { prenom, nom, email, sujet, message } = req.body

  /* Validation des champs obligatoires */
  if (!prenom || !email || !message) {
    return res.status(400).json({
      succes: false,
      message: 'Prénom, email et message sont obligatoires'
    })
  }

  /* Log du message dans la console */
  console.log(
    '📩 Nouveau message de ' + email +
    ' — Sujet : ' + sujet
  )

  /* Confirmation au frontend */
  res.json({
    succes: true,
    message:
      'Votre message a bien été reçu. Réponse sous 24h.'
  })
})


/* ============================================================
   DÉMARRAGE DU SERVEUR
   ============================================================
   app.listen() démarre le serveur et le fait écouter sur un port.

   process.env.PORT est fourni automatiquement par Render
   en production. En local, on utilise 3000 par défaut.

   L'opérateur || (OU logique) prend la première valeur "truthy" :
     - Si process.env.PORT existe → on l'utilise
     - Sinon → on utilise 3000
   ============================================================ */
const PORT = process.env.PORT || 3000

app.listen(PORT, function() {
  console.log(
    '🚀 Serveur LearnWithUs démarré sur le port ' + PORT
  )
  console.log(
    '   → Santé : http://localhost:' + PORT + '/api/health'
  )
})
