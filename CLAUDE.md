# CLAUDE.md — Guide de contexte pour Claude Code

## Projet
**LearnWithUs** — Site web d'un organisme de formation numérique (IA, SCRUM, SAP).
Projet scolaire réalisé en équipe avec une méthodologie agile.

## Stack technique
- **Frontend** : HTML + CSS + JS vanilla (pas de framework)
- **Backend** : Node.js + Express
- **Hébergement prévu** : Vercel (front) / Render (back)
- **Automatisation** : n8n (workflows email/CRM)
- **Règles de code** : tout commenté en français, variables en français, pas de framework CSS/JS

## Structure
```
LearnWithUs/
├── frontend/
│   ├── index.html               ← Page Accueil
│   ├── formations.html          ← Catalogue + formulaire inscription
│   ├── espace-client.html       ← Onglets Standard/Premium
│   ├── contact.html             ← Formulaire contact + infos
│   ├── faq.html                 ← 10 questions accordéon
│   ├── connexion.html           ← Connexion au compte (fonctionnelle)
│   ├── inscription-compte.html  ← Création de compte (fonctionnelle)
│   ├── paiement.html            ← Paiement fictif → passage Premium
│   ├── admin.html               ← Dashboard admin (KPI + dernières activités)
│   ├── formation-ia.html        ← Cours IA (intro gratuite + Premium)
│   ├── formation-scrum.html     ← Cours SCRUM (intro + Premium)
│   ├── formation-sap.html       ← Cours SAP (intro + Premium)
│   ├── favicon.svg              ← Icône site
│   ├── robots.txt               ← Indexation SEO
│   ├── sitemap.xml              ← Plan du site SEO
│   ├── css/style.css            ← Styles communs
│   └── js/main.js               ← JS commun (auth, quiz, paiement)
├── backend/
│   ├── server.js                ← Serveur Express (API)
│   ├── package.json             ← Dépendances Node.js
│   ├── .env.example             ← Modèle variables d'environnement
│   ├── n8n-workflow-inscription.json ← Workflow n8n #1 (inscription)
│   ├── n8n-workflow-contact.json     ← Workflow n8n #2 (contact)
│   ├── n8n-workflow-relance.json     ← Workflow n8n #3 (relance leads 7j)
│   └── n8n-workflow-paiement.json    ← Workflow n8n #4 (confirmation paiement)
├── vercel.json                  ← Config Vercel
└── README.md                    ← Guide d'installation
```

## Phases du projet et avancement

### Phase 1 : Kickoff (13/03 - 27/03) — TERMINÉE
- T1.1 à T1.5 : cadrage, rôles, outils — fait par l'équipe

### Phase 2 : Analyse & Planification (13/03 - 27/03) — TERMINÉE
- T2.1 à T2.8 : cahier des charges, Use Case, BPMN, roadmap, RACI, risques, benchmark, archi SI — fait par l'équipe

### Phase 3 : Prototypes & Archi (28/03 - 17/04) — TERMINÉE
- [x] T3.1 : Création du site web (pages obligatoires) — FAIT (14/04)
  - 5 pages HTML créées (index, formations, espace-client, contact, faq)
  - 2 pages supplémentaires : connexion.html, inscription-compte.html
  - CSS complet avec variables, responsive, composants
  - JS complet (menu mobile, formulaires fetch, onglets, accordéon FAQ)
  - Backend Express avec routes /api/health, /api/inscription, /api/contact
- [x] T3.2 : Hébergement et mise en ligne — FAIT (14/04)
  - Frontend : https://learn-with-us-lac.vercel.app/
  - Backend  : https://learnwithus-backend.onrender.com
- [x] T3.4 : Prototype Low Code v1 (base de données) — FAIT (14/04)
  - Base Notion "Inscriptions" créée (Prénom, Nom, Email, Formation, Téléphone, Date, Statut)
  - Backend connecté via SDK @notionhq/client
  - Chaque inscription est sauvegardée automatiquement dans Notion
- [x] T3.5 : Workflow n8n #1 — Inscription → Email — FAIT (15/04)
  - Workflow importé depuis n8n-workflow-inscription.json
  - Email de confirmation envoyé à l'étudiant
  - Email de notification envoyé à l'équipe (3 adresses)
  - Credential SMTP Gmail configurée
- [x] T3.6 : Mise à jour dossier de suivi projet (v1) — FAIT (15/04)

### Phase 4 : Intégration & Auto. (18/04 - 21/05) — EN COURS
- [x] T4.1 : Finalisation site web (contenu + SEO) — FAIT (20/04)
  - Corrections : faute 'learnnwithus.fr', alert() remplacés par messages propres
  - Contenu enrichi : section "Chiffres clés" (accueil), +2 FAQ (prérequis, CPF), adresse (contact)
  - SEO de base : meta description + author sur 7 pages, favicon.svg, sitemap.xml, robots.txt
- [x] T4.2 : Intégration contenus e-learning (pages formations) — FAIT (21/04)
  - 3 pages formation créées (formation-ia.html, formation-scrum.html, formation-sap.html)
  - Structure par page : intro gratuite (teaser) + cours théorique + vidéo (placeholder) + quiz 10 Q + ressources
  - Cours complets avec section "Actualités 2026" pour chaque domaine
  - Quiz 10 questions avec bouton Recommencer (score stocké en localStorage)
  - Placeholders PDF Gamma ("Bientôt disponible") en attente des supports
  - Vidéos : placeholders — **tournage en Phase 5 (T5.1-T5.3) puis intégration (T5.4)**
  - Blocage du contenu Premium via JS (floue + CTA pour non-connectés / Standard)
- [x] T4.3 : Workflow n8n #2 (contact) + CRM Notion + Workflow #3 (relance) — FAIT (21/04)
  - Workflow n8n #2 dédié au formulaire contact (accusé réception + notification équipe)
  - Base Notion "CRM LearnWithUs" créée (Nom complet, Email, Téléphone, Source, Formation, Pipeline: Lead → Contacté → Client Standard → Client Premium → Perdu, dates, notes, ID Lead auto)
  - Backend : helper `synchroniserCRM()` branché sur /api/inscription, /api/creer-compte, /api/activer-premium, /api/contact (upsert par email)
  - Workflow n8n #3 (n8n-workflow-relance.json) : cron quotidien 9h → query leads > 7 jours → email relance → Pipeline passe à "Contacté"
  - Variable env à ajouter sur Render : NOTION_DS_CRM_ID = 272e0bb6-df6d-462d-8359-f704f9a3f18e
- [x] Authentification + Comptes + Paiement (bonus Phase 4) — FAIT (20-21/04)
  - Base Notion "Comptes LearnWithUs" créée (email, mdp hashé bcrypt, statut, dates)
  - Backend : routes /api/creer-compte, /api/connexion, /api/activer-premium (JWT)
  - Frontend : pages connexion/inscription fonctionnelles, session localStorage
  - Nav adaptative : pastille prénom + déconnexion si connecté
  - Page paiement.html : formulaire carte fictif → bascule statut Premium dans Notion
- [x] Render CLI + monitoring — FAIT (21/04)
  - Render CLI installée localement, authentifiée, workspace configuré
  - Health check path configuré sur /api/health (évite timeouts de deploy)
- [x] T4.5 (support) : Base Notion Transactions + Workflow n8n #4 (paiement) — FAIT (21/04)
  - Base Notion "Transactions LearnWithUs" (Référence TXN-YYYYMMDD-HHMMSS, Email, Formation, Montant, Date, Statut)
  - /!\ Aucune donnée bancaire stockée — RGPD + évite contrainte PCI DSS
  - Backend : helper `enregistrerTransaction()` appelé depuis /api/activer-premium
  - Workflow n8n #4 (n8n-workflow-paiement.json) : reçu client + notif équipe
  - 2 env vars à ajouter sur Render : NOTION_DS_TRANSACTIONS_ID + WEBHOOK_N8N_PAIEMENT_URL
- [x] Dashboard admin (bonus Phase 4) — FAIT (21/04)
  - Page admin.html (noindex) : 6 cartes KPI, 2 blocs répartition (formations + pipeline CRM), 2 tableaux (dernières inscriptions + transactions)
  - Backend : middleware `verifierAdmin` (check contre ADMIN_EMAILS), route GET /api/admin/stats agrégeant les 4 bases Notion en parallèle
  - JWT enrichi d'un drapeau `estAdmin` → lien "🔐 Admin" visible dans la nav uniquement pour les admins
  - 2 env vars à ajouter sur Render : ADMIN_EMAILS (liste séparée par virgules) + NOTION_DS_INSCRIPTIONS_ID
- [ ] T3.3 : Schéma architecture SI (version complète)
- [ ] T4.5 (livrable) : Documentation IA Assistée (feature Paiement) — en cours
- [ ] T4.6 : Mise à jour dossier de suivi projet (v2)

### Phase 5 : Finalisation (21/05 - 16/07) — À VENIR
- [ ] T5.1-T5.3 : Tournage vidéos (IA, SCRUM, SAP)
- [ ] T5.4 : Intégration finale des 3 vidéos sur le site
- [ ] T5.5 : Prototype Low Code - version finale
- [ ] T5.6 : Contrat de maintenance
- [ ] T5.7 : Audit SEO & recommandations sécurité
- [ ] T5.8 : Axes d'amélioration (optionnel)
- [ ] T5.9-T5.10 : Dossier final, relecture, répétition

## Commandes utiles
```bash
# Installer les dépendances backend
cd backend && npm install

# Lancer le serveur backend en dev
npm run dev

# Lancer le serveur backend en production
npm start

# Frontend : ouvrir index.html avec Live Server (VS Code)
```

## Points importants
- La constante URL_BACKEND dans frontend/js/main.js doit être mise à jour avec l'URL Render en production
- Le fichier backend/.env doit être créé à partir de .env.example (ne jamais committer .env)
- Webhooks n8n configurés via 2 variables d'environnement sur Render :
  - WEBHOOK_N8N_URL (inscription formation)
  - WEBHOOK_N8N_CONTACT_URL (formulaire contact)
- Authentification : bcrypt pour le hash mot de passe, JWT 7 jours signé avec JWT_SECRET (env var Render)
- 4 bases Notion distinctes : "Inscriptions", "Comptes LearnWithUs", "CRM LearnWithUs", "Transactions LearnWithUs" (IDs séparés)
- Paiement fictif (pas de Stripe réel) : bascule Statut Notion à "Premium" + log transaction + trigger n8n #4
- /!\ AUCUNE donnée bancaire (carte, CVV, expiration) n'est stockée — conformité RGPD + évite PCI DSS. Uniquement métadonnées (email, montant, date, référence)
- CRM Notion : alimenté en upsert (recherche par email, create si absent, update sinon). 4 points d'entrée : /api/inscription, /api/creer-compte, /api/activer-premium, /api/contact
- Env vars Render à configurer : NOTION_DS_CRM_ID, NOTION_DS_TRANSACTIONS_ID, WEBHOOK_N8N_PAIEMENT_URL (sinon les routes répondent mais n'alimentent pas ces composants)
- Render CLI installée localement pour monitoring des deploys et logs (voir reference_render.md en mémoire)

## Durée des formations (design validé)
Chaque formation Premium dure ≥ 15 min au total :
- Lecture intro (~1 min) + cours complet (~8 min) + vidéo (10 min) + quiz 10 Q (~5 min) = ~24 min
