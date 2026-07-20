# LearnWithUs — Site Web

Site web complet pour **LearnWithUs**, un organisme de formation numerique proposant 3 formations : Intelligence Artificielle, Agilite & SCRUM (en anglais), et SAP.

**Stack technique** : HTML + CSS + JavaScript vanilla (frontend) / Node.js (fonctions serverless, backend) / Notion (base de donnees) / n8n.cloud (automatisations email)

**Hebergement** : Vercel (palier Hobby, gratuit) - fonctions serverless Node.js 24.x + Vercel Blob Storage (videos) + Upstash Redis (anti-bruteforce, sessions)

**URL de production** : https://learn-with-us-lac.vercel.app


## Structure du projet

```
LearnWithUs/
|
|-- frontend/                       <- Racine deployee sur Vercel
|   |-- index.html                  <- Page Accueil
|   |-- formations.html             <- Catalogue des 3 formations
|   |-- formation-ia.html           <- Cours Intelligence Artificielle
|   |-- formation-scrum.html        <- Cours SCRUM (en anglais)
|   |-- formation-sap.html          <- Cours SAP
|   |-- espace-client.html          <- Onglets Standard / Premium
|   |-- parametres.html             <- Mes informations + suppression compte
|   |-- contact.html                <- Formulaire de contact
|   |-- faq.html                    <- Foire aux questions
|   |-- connexion.html              <- Connexion utilisateur
|   |-- inscription-compte.html     <- Creation de compte
|   |-- paiement.html               <- Paiement Premium fictif
|   |-- admin.html                  <- Dashboard administrateur
|   |-- reset-mot-de-passe.html     <- Reinitialisation mot de passe
|   |-- mentions-legales.html       <- Mentions legales, CGU, confidentialite
|   |-- 404.html                    <- Page d'erreur personnalisee
|   |-- sitemap.xml / robots.txt    <- SEO
|   |-- favicon.svg                 <- Icone du site
|   |-- docs/supports/              <- PDF des supports de cours (Premium)
|   |-- css/style.css               <- Styles communs
|   |-- js/main.js                  <- JavaScript commun
|   |-- package.json                <- Dependances des fonctions serverless
|   |-- vercel.json                 <- Rewrites (routes admin fusionnees, cf. plus bas)
|   |
|   |-- api/                        <- Backend : fonctions serverless Node.js
|       |-- _lib/                   <- Helpers partages (prefixe _ ignore par le routing Vercel)
|       |   |-- notion.js           <- Wrapper API Notion (fetch natif)
|       |   |-- webhook.js          <- Appel webhooks n8n
|       |   |-- crm.js              <- Synchronisation CRM Notion
|       |   |-- comptes.js          <- Recherche / lecture comptes
|       |   |-- auth.js             <- exigerConnexion / exigerAdmin
|       |   |-- cookie.js           <- Session (cookie signe HMAC + revocation via Redis)
|       |   |-- hmac.js             <- Primitive de signature generique
|       |   |-- token.js            <- Tokens reset mot de passe (usage unique)
|       |   |-- bcryptCompat.js     <- Hash mots de passe (bcryptjs)
|       |   |-- rateLimit.js        <- Anti-bruteforce + verrous anti-doublon (Upstash Redis)
|       |   |-- transactions.js     <- Enregistrement paiements Notion
|       |   |-- http.js             <- Bootstrap commun (parsing, reponses JSON)
|       |-- health.js               <- Sonde de sante
|       |-- contact.js              <- Formulaire contact
|       |-- creer-compte.js         <- Creation compte + session
|       |-- connexion.js            <- Login session
|       |-- deconnexion.js          <- Detruit session (+ revocation serveur)
|       |-- activer-premium.js      <- Bascule Standard -> Premium
|       |-- supprimer-compte.js     <- RGPD - droit a l'effacement
|       |-- mdp-demande.js          <- Demande lien reset mot de passe
|       |-- mdp-confirmer.js        <- Applique nouveau mot de passe
|       |-- admin/
|           |-- handler.js          <- stats + changer-statut + supprimer-compte (fusionnees,
|                                       cf. "Limite de fonctions Vercel" plus bas)
|
|-- backend-php/                    <- ARCHIVE : ancien backend PHP (production jusqu'a la
|                                       migration Vercel), conserve comme reference, plus deploye
|-- README.md                       <- Ce fichier
```


## Pourquoi Node.js et pas PHP ?

Le site tournait initialement sur un backend PHP procedural, heberge sur IONOS (voir `backend-php/`, conserve dans le repo comme reference). Suite a la resiliation de cet hebergement, le backend a ete entierement porte vers des **fonctions serverless Node.js deployees sur Vercel**, avec un contrat d'API strictement identique (mêmes routes, mêmes reponses JSON, mêmes regles metier) pour ne rien casser côté frontend.

Deux briques externes remplacent ce que PHP faisait nativement sur un serveur classique :
- **Upstash Redis** (palier gratuit) : le disque d'une fonction serverless ne persiste pas entre deux appels, contrairement a un fichier PHP sur un serveur classique. Redis stocke donc l'anti-bruteforce (tentatives de connexion) et la revocation de session (deconnexion, reset mot de passe, changement de statut admin invalident immediatement les cookies actifs).
- **Vercel Blob Storage** (palier gratuit, 1 Go) : les 3 videos de cours (~730 Mo) etaient deployees a part sur IONOS via FileZilla, en dehors du depot Git. Vercel ne deployant que ce qui est versionne, les videos sont desormais heberges sur Vercel Blob et referencees par URL absolue dans les pages `formation-*.html`.


## Limite de fonctions Vercel (palier Hobby)

Le palier gratuit de Vercel limite un deploiement a **12 fonctions serverless**. Le decoupage naturel (1 fichier = 1 route) en comptait 13, ce qui faisait echouer chaque deploiement (`exceeded_serverless_functions_per_deployment`). Les 3 routes admin (`stats`, `changer-statut`, `supprimer-compte`) sont donc regroupees dans un seul fichier `api/admin/handler.js`, avec un dispatch interne sur le chemin de la requete ; `vercel.json` redirige les 3 URLs publiques vers ce fichier unique (`rewrites`). Aucun changement cote appelant (frontend) : les URLs `/api/admin/stats`, `/api/admin/changer-statut`, `/api/admin/supprimer-compte` restent inchangees.


## Installation locale (etape par etape)

### Prerequis

- **Node.js 24.x** ([nodejs.org](https://nodejs.org))
- **Vercel CLI** : `npm install -g vercel`
- **VS Code** ou tout editeur de code

### 1. Cloner le projet

```bash
git clone https://github.com/WissamTahiri/LearnWithUs.git
cd LearnWithUs/frontend
```

### 2. Installer les dependances

```bash
npm install
```

### 3. Configurer les variables d'environnement

Lier le projet a Vercel puis recuperer les variables (necessite un acces au projet Vercel `learn-with-us`) :

```bash
vercel link
vercel env pull .env.local
```

Ou, pour un developpement independant, creer `.env.local` a la racine de `frontend/` avec :

- `NOTION_TOKEN` - token d'integration Notion ([notion.so/my-integrations](https://www.notion.so/my-integrations))
- `NOTION_DATABASE_COMPTES_ID` - ID de la base "Comptes LearnWithUs"
- `NOTION_DS_COMPTES_ID` / `NOTION_DS_CRM_ID` / `NOTION_DS_TRANSACTIONS_ID` - IDs des data sources Notion
- `WEBHOOK_N8N_BIENVENUE` / `WEBHOOK_N8N_CONTACT` / `WEBHOOK_N8N_PAIEMENT` / `WEBHOOK_N8N_RESET_MDP` - URLs des webhooks n8n
- `ADMIN_EMAILS` - liste des emails admin separes par virgules
- `APP_SECRET` - chaine aleatoire 32+ octets : `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
- `URL_SITE` - URL du site (pour les liens dans les emails)
- `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` - base Redis Upstash (plan Free, [upstash.com](https://upstash.com))
- `BLOB_READ_WRITE_TOKEN` - injecte automatiquement par Vercel si un store Blob est lie au projet

Mot de passe utilisateur : 8 caracteres minimum, avec au moins 1 majuscule et 1 chiffre (verifie cote backend ET frontend).

### 4. Tester en local

```bash
vercel dev
```

Ouvrez dans votre navigateur :

- `http://localhost:3000/index.html` - page d'accueil
- `http://localhost:3000/api/health` - sonde de sante
  (doit renvoyer `{"statut":"ok",...}`)


## Deploiement (Vercel)

Le projet `learn-with-us` sur Vercel est connecte au depot GitHub `WissamTahiri/LearnWithUs` : chaque `git push` sur `main` declenche automatiquement un nouveau deploiement en production.

- **Root Directory** du projet Vercel : `frontend` (le dossier `backend-php/` a la racine du depot n'est pas deploye)
- **Variables d'environnement** : configurees dans Vercel (Project Settings -> Environment Variables), jamais commitees
- **Videos de cours** : uploadees une fois sur Vercel Blob via `vercel blob put <fichier> --access public --pathname videos/<nom>.mp4`, referencees par URL absolue dans les pages `formation-*.html` (pas besoin de re-upload a chaque deploiement)


## Email professionnel (IONOS)

Le domaine `learnwithus.fr` et la boite mail `contact@learnwithus.fr` (Email Basic 2 Go) restent actifs chez IONOS independamment de l'hebergement web (produits separes) :
- Reception des messages du formulaire de contact (relaye par n8n)
- **Expediteur SMTP des workflows n8n** (point critique pour la delivrabilite : sans cela les emails partent depuis Gmail et sont rejetes par les FAI .fr a cause du SPF)

Webmail accessible sur https://mail.ionos.fr.


## Configuration n8n (5 workflows)

Workflows heberges sur n8n.cloud (instance `persia-esgi`). Tous utilisent le **credential SMTP IONOS** suivant :

```
Host:     smtp.ionos.fr
Port:     587
User:     contact@learnwithus.fr
Password: (mot de passe defini lors de la creation de la boite IONOS)
STARTTLS: ACTIVE (NE PAS desactiver - sinon erreur 530 User not authenticated)
```

| # | Workflow | Declenche par |
|---|---|---|
| 1 | Bienvenue | Creation de compte (`/api/creer-compte`) |
| 2 | Contact | Formulaire contact (`/api/contact`) |
| 3 | Relance leads 15j | Schedule (tous les 15 jours, 9h) |
| 4 | Paiement Premium | Activation Premium (`/api/activer-premium`) |
| 5 | Reset mot de passe | Demande reset (`/api/mdp-demande`) |

Apres import des workflows JSON, chaque URL `Production` (pas `Test`) est collee dans la variable d'environnement correspondante sur Vercel. Les 5 workflows doivent etre **actives** (toggle vert en haut a droite de l'editeur n8n) pour que les webhooks Production repondent.


## Aide

- **Email** : contact@learnwithus.fr
- **FAQ** : consultez la page FAQ du site
