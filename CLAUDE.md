# CLAUDE.md — Guide de contexte pour Claude Code

## Projet
**LearnWithUs** — Site web d'un organisme de formation numérique (IA, SCRUM, SAP).
Projet scolaire 2MCSI ESGI réalisé par Wissam, Hilel et Sanjay avec une méthodologie agile.

## Stack technique
- **Frontend** : HTML + CSS + JS vanilla (pas de framework)
- **Backend** : PHP 8.x procédural (pas de framework, pas de Composer)
- **Base de données** : Notion (4 bases via API REST)
- **Hébergement** : IONOS (~8€/mois) — domaine `learnwithus.fr`
- **Setup local** : MAMP (PHP 8.3.1)
- **Automatisation** : n8n.cloud (5 workflows email/CRM)
- **Règles de code** : tout commenté en français (~40% de la page), variables et fonctions en français, pas de framework CSS/JS

## Structure du projet (post-migration PHP)
```
LearnWithUs/
├── frontend/
│   ├── index.html               ← Page Accueil
│   ├── formations.html          ← Catalogue (CTA création compte)
│   ├── espace-client.html       ← Onglets Standard/Premium
│   ├── parametres.html          ← Mes paramètres + suppression compte (RGPD)
│   ├── contact.html             ← Formulaire contact
│   ├── faq.html                 ← 10 questions accordéon
│   ├── connexion.html           ← Connexion (sessions PHP)
│   ├── inscription-compte.html  ← Création de compte + formation d'intérêt
│   ├── paiement.html            ← Paiement fictif → passage Premium
│   ├── admin.html               ← Dashboard admin (KPI + gestion comptes)
│   ├── reset-mot-de-passe.html  ← Mot de passe oublié (2 états)
│   ├── formation-ia.html        ← Cours IA (intro gratuite + Premium)
│   ├── formation-scrum.html     ← Cours SCRUM (intro + Premium)
│   ├── formation-sap.html       ← Cours SAP (intro + Premium)
│   ├── favicon.svg              ← Icône site
│   ├── css/style.css            ← Styles communs
│   └── js/main.js               ← JS commun (auth, quiz, paiement)
├── backend-php/
│   ├── config.php               ← Secrets (Notion token, IDs DBs, n8n URLs, APP_SECRET) — gitignored
│   ├── helpers/
│   │   ├── notion.php           ← Wrapper API Notion via cURL
│   │   ├── webhook.php          ← Appel webhooks n8n
│   │   ├── crm.php              ← Synchronisation CRM Notion (upsert)
│   │   ├── comptes.php          ← Recherche / lecture comptes
│   │   ├── auth.php             ← Sessions PHP, exigerConnexion, exigerAdmin
│   │   ├── rate-limit.php       ← Anti-brute force (5 tentatives / 15 min)
│   │   ├── token.php            ← HMAC tokens (reset mdp + vérif email)
│   │   └── transactions.php     ← Enregistrement transactions Notion
│   ├── api/
│   │   ├── _init.php            ← Bootstrap (lireRequete, repondreJson, exigerMethode)
│   │   ├── health.php           ← Sonde de santé
│   │   ├── contact.php          ← Formulaire contact
│   │   ├── creer-compte.php     ← Création compte + session
│   │   ├── connexion.php        ← Login session
│   │   ├── deconnexion.php      ← Détruit session
│   │   ├── session.php          ← Renvoie l'utilisateur connecté
│   │   ├── activer-premium.php  ← Bascule Standard → Premium
│   │   ├── supprimer-compte.php ← Utilisateur supprime son compte (RGPD)
│   │   ├── mdp-demande.php      ← Demande lien reset (token HMAC 15 min)
│   │   ├── mdp-confirmer.php    ← Applique nouveau mdp
│   │   └── admin/
│   │       ├── stats.php        ← Dashboard admin agrégé
│   │       ├── changer-statut.php  ← Standard ↔ Premium
│   │       └── supprimer-compte.php ← Admin archive un compte
│   └── data/                    ← Stocke fichiers rate-limit (gitignored)
└── README.md                    ← Guide d'installation

Note : tous les livrables (PDFs Phase 2, schémas archi, supports de cours,
fiches de révision, doc IA assistée) ont été déplacés hors du projet vers
"C:\Users\elhou\Documents\LearnWithUs Doc\" pour ne pas alourdir le ZIP
final ni encombrer VS Code lors des démos. Sous-dossiers :
- docs/        → architecture-si.* , audit-seo.md , IA_Assistee_*.pdf , phase2/*.html
- supports/    → cours-ia.pdf, cours-scrum.pdf, cours-sap.pdf
- fiches/      → 4 fiches HTML de révision (front #1, front #2, back #1, back #2)
```

## Architecture en 1 phrase
Le navigateur charge les pages HTML/CSS/JS depuis IONOS, soumet les formulaires au backend PHP (sessions cookies), qui parle à Notion (stockage) et à n8n.cloud (envois email).

## Phases du projet et avancement

### Phase 1 : Kickoff (13/03 - 27/03) — TERMINÉE
- T1.1 à T1.5 : cadrage, rôles, outils — fait par l'équipe

### Phase 2 : Analyse & Planification (13/03 - 27/03) — TERMINÉE
- T2.1 à T2.8 : cahier des charges, Use Case, BPMN, roadmap, RACI, risques, benchmark V1, archi SI v1 — fait par l'équipe

### Phase 3 : Prototypes & Archi (28/03 - 17/04) — TERMINÉE
- T3.1 — Création du site web (HTML/CSS/JS)
- T3.2 — Hébergement et mise en ligne (livré sur Vercel/Render à l'époque, **migré IONOS en Phase 4**)
- T3.4 — Prototype Low Code v1 : 4 bases Notion connectées via API
- T3.5 — Workflow n8n #1 (Bienvenue) fonctionnel
- T3.6 — Dossier de suivi projet (v1)

### Phase 4 : Intégration & Auto. (18/04 - 21/05) — EN COURS
- [x] T4.1 — Finalisation site web (contenu + SEO)
- [x] T4.2 — Intégration contenus e-learning (3 pages formation)
- [x] T4.3 — Workflows n8n #2 (contact) + #3 (relance) + CRM Notion
- [x] Authentification + Comptes + Paiement Premium
- [x] T4.5 — Transactions + Workflow n8n #4 (paiement)
- [x] Dashboard admin
- [x] Sécurité : reset mdp, vérif email, rate-limit, sessions
- [x] **Migration Node.js → PHP** (avril 2026) — pivot stratégique pour soutenance
  - Justification : équipe non-dev, PHP au programme du cursus, crédibilité jury
  - Backend complètement réécrit en PHP procédural (zéro dépendance externe)
  - JWT remplacé par sessions PHP natives + tokens HMAC pour les liens email
  - bcrypt → password_hash() natif, fetch → cURL natif
  - Frontend adapté (`js/main.js`) : credentials cookie au lieu de Authorization Bearer
- [ ] T3.3 — Schéma architecture SI v2 (post-migration PHP/IONOS)
- [ ] T4.5 livrable — Documentation IA Assistée (PDF "IA_Assistee_LearnWithUs_Paiement.pdf")
- [ ] T4.6 — Dossier de suivi projet v2
- [ ] Déploiement IONOS — programmé après validation équipe

### Phase 5 : Finalisation (21/05 - 16/07) — À VENIR
- T5.1-T5.3 : Tournage vidéos (IA, SCRUM, SAP)
- T5.4 : Intégration finale des 3 vidéos
- T5.5 : Prototype Low Code version finale
- T5.6 : Contrat de maintenance
- T5.7 : Audit SEO & recommandations sécurité
- T5.8 : Axes d'amélioration
- T5.9-T5.10 : Dossier final + soutenance

## Commandes utiles
```bash
# Setup local : démarrer MAMP (PHP 8.3.1, Apache port 8888)
# Document Root MAMP : C:\dev\Projet Annuel 2MCSI\LearnWithUs

# Tester le backend en CLI
"/c/MAMP/bin/php/php8.3.1/php.exe" -c "/c/MAMP/conf/php8.3.1/php.ini" -l backend-php/api/contact.php

# Lancer un serveur de test sans MAMP
"/c/MAMP/bin/php/php8.3.1/php.exe" -c "/c/MAMP/conf/php8.3.1/php.ini" -S localhost:8765 -t .

# Purger le rate-limit (si bloqué après trop de tentatives)
rm backend-php/data/rl-*.json
```

## Points importants
- `backend-php/config.php` n'est PAS commit (gitignored). Contient : NOTION_TOKEN, IDs des 4 bases Notion, URLs des 5 webhooks n8n, ADMIN_EMAILS, APP_SECRET (HMAC).
- Authentification = sessions PHP natives. `password_hash()` natif (équivalent bcrypt). Pas de JWT pour les sessions.
- Tokens email (reset mot de passe) = HMAC SHA256 maison (`helpers/token.php`), stateless, signés avec APP_SECRET.
- 4 bases Notion : "Comptes LearnWithUs", "CRM LearnWithUs", "Transactions LearnWithUs", "Inscriptions Formations" (legacy, non alimentée).
- Paiement fictif : aucune donnée bancaire stockée (RGPD + évite PCI DSS). Uniquement métadonnées (email, montant, date, référence).
- CRM alimenté en upsert depuis 3 routes : creer-compte, activer-premium, contact.
- Anti-brute force fichier-based dans `backend-php/data/` (5 tentatives / 15 min par IP).

## Durée des formations (design validé)
Chaque formation Premium dure ≥ 15 min au total :
- Lecture intro (~1 min) + cours complet (~8 min) + vidéo (10 min) + quiz 10 Q (~5 min) = ~24 min
