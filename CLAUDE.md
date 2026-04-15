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
│   ├── index.html            ← Page Accueil
│   ├── formations.html       ← Catalogue + formulaire inscription
│   ├── espace-client.html    ← Onglets Standard/Premium
│   ├── contact.html          ← Formulaire contact + infos
│   ├── faq.html              ← 8 questions accordéon
│   ├── css/style.css         ← Styles communs
│   └── js/main.js            ← JavaScript commun
├── backend/
│   ├── server.js             ← Serveur Express (API)
│   ├── package.json          ← Dépendances Node.js
│   └── .env.example          ← Modèle variables d'environnement
├── vercel.json               ← Config Vercel
└── README.md                 ← Guide d'installation
```

## Phases du projet et avancement

### Phase 1 : Kickoff (13/03 - 27/03) — TERMINÉE
- T1.1 à T1.5 : cadrage, rôles, outils — fait par l'équipe

### Phase 2 : Analyse & Planification (13/03 - 27/03) — TERMINÉE
- T2.1 à T2.8 : cahier des charges, Use Case, BPMN, roadmap, RACI, risques, benchmark, archi SI — fait par l'équipe

### Phase 3 : Prototypes & Archi (28/03 - 17/04) — EN COURS
- [x] T3.1 : Création du site web (pages obligatoires) — FAIT (14/04)
  - 5 pages HTML créées (index, formations, espace-client, contact, faq)
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
- [ ] T3.5 : Workflow n8n #1 — Inscription → Email
- [ ] T3.6 : Mise à jour dossier de suivi projet (v1)

### Phase 4 : Intégration & Auto. (18/04 - 21/05) — À VENIR
- [ ] T4.1 : Finalisation site web (contenu + SEO)
- [ ] T4.2 : Intégration contenus e-learning (vidéos)
- [ ] T4.3 : Workflow n8n #2 Prospect → CRM
- [ ] T3.3 : Schéma architecture SI (version complète)
- [ ] T4.5 : Fonctionnalité IA Assistée + documentation
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
- Le webhook n8n sera connecté via la variable WEBHOOK_N8N_URL dans .env
