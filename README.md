# LearnWithUs — Site Web

Site web complet pour **LearnWithUs**, un organisme de formation numerique proposant 3 formations : Intelligence Artificielle, Agilite & SCRUM, et SAP.

**Stack technique** : HTML + CSS + JavaScript vanilla (frontend) / Node.js + Express (backend)


## Structure du projet

```
LearnWithUs/
|
|-- frontend/                   <- Partie visible du site (ce que voit l'utilisateur)
|   |-- index.html              <- Page Accueil (hero + cartes formations)
|   |-- formations.html         <- Catalogue detaille + formulaire d'inscription
|   |-- espace-client.html      <- Onglets Standard (gratuit) et Premium (29EUR/mois)
|   |-- contact.html            <- Formulaire de contact + infos
|   |-- faq.html                <- 8 questions frequentes en accordeon
|   |-- css/
|   |   |-- style.css           <- Styles communs a toutes les pages
|   |-- js/
|       |-- main.js             <- JavaScript commun (formulaires, menu, onglets, FAQ)
|
|-- backend/                    <- Serveur qui recoit les donnees des formulaires
|   |-- server.js               <- Serveur Node.js / Express (routes API)
|   |-- package.json            <- Liste des modules Node.js necessaires
|   |-- .env.example            <- Modele de variables d'environnement
|
|-- vercel.json                 <- Configuration deploiement Vercel (frontend)
|-- README.md                   <- Ce fichier (guide d'installation)
```


## Installation locale (etape par etape)

### Prerequis

- **Node.js** (version 18 ou superieure) : [nodejs.org](https://nodejs.org)
- **Un editeur de code** : VS Code recommande ([code.visualstudio.com](https://code.visualstudio.com))
- **Un navigateur** : Chrome, Firefox, Edge

### 1. Cloner le projet

```bash
git clone https://github.com/votre-utilisateur/learnnwithus.git
cd learnnwithus
```

### 2. Installer les dependances du backend

```bash
cd backend
npm install
```

Cette commande lit le fichier `package.json` et telecharge les modules necessaires (Express, CORS, dotenv) dans un dossier `node_modules/`.

### 3. Configurer les variables d'environnement

```bash
cp .env.example .env
```

Ouvrez le fichier `.env` et remplissez les valeurs si necessaire. Pour commencer en local, les valeurs par defaut suffisent.

### 4. Lancer le serveur backend

```bash
npm start
```

Ou en mode developpement (redemarre automatiquement a chaque modification) :

```bash
npm run dev
```

Le serveur demarre sur `http://localhost:3000`. Verifiez en ouvrant `http://localhost:3000/api/health` dans votre navigateur.

### 5. Ouvrir le frontend

**Option A** — Ouvrir directement `frontend/index.html` dans votre navigateur (double-clic sur le fichier).

**Option B** (recommandee) — Utiliser l'extension VS Code **Live Server** :
1. Installez l'extension "Live Server" dans VS Code
2. Clic droit sur `frontend/index.html` > "Open with Live Server"
3. Le site s'ouvre automatiquement dans votre navigateur

Live Server recharge automatiquement la page quand vous modifiez un fichier.


## Deploiement Vercel (frontend)

1. Creez un compte sur [vercel.com](https://vercel.com)
2. Cliquez sur "New Project"
3. Connectez votre depot GitHub
4. **Root Directory** : selectionnez `frontend`
5. **Framework Preset** : selectionnez "Other"
6. Cliquez sur "Deploy"
7. Votre site est en ligne ! Notez l'URL (ex: `learnnwithus.vercel.app`)


## Deploiement Render (backend)

1. Creez un compte sur [render.com](https://render.com)
2. Cliquez sur "New" > "Web Service"
3. Connectez votre depot GitHub
4. **Root Directory** : `backend`
5. **Build Command** : `npm install`
6. **Start Command** : `npm start`
7. Dans l'onglet **Environment**, ajoutez la variable :
   - `WEBHOOK_N8N_URL` : l'URL de votre webhook n8n (une fois cree)
8. Cliquez sur "Deploy"
9. Notez l'URL Render (ex: `learnnwithus.onrender.com`)

**Important** : Apres le deploiement Render, mettez a jour la constante `URL_BACKEND` dans `frontend/js/main.js` avec l'URL Render de votre backend.


## Connecter au workflow n8n

1. Creez votre instance n8n (sur Railway, self-hosted, ou n8n.cloud)
2. Creez un workflow avec un noeud **Webhook** comme declencheur
3. Copiez l'URL du webhook
4. Collez-la dans la variable `WEBHOOK_N8N_URL` :
   - En local : dans le fichier `backend/.env`
   - En production : dans les variables d'environnement Render
5. n8n recevra les inscriptions et pourra envoyer des emails automatiques


## Aide

- **Support** : contact@learnnwithus.fr
- **FAQ** : consultez la page FAQ du site
