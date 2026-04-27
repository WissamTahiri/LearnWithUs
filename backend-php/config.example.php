<?php
/* =============================================================
   config.example.php — MODÈLE de configuration (à recopier)
   =============================================================
   Pour démarrer le projet en local, copier ce fichier en :
       backend-php/config.php
   puis remplir les valeurs ci-dessous avec les vrais secrets.

   /!\ NE JAMAIS commit config.php sur Git (déjà gitignored).
   ============================================================= */


/* =============================================================
   1. NOTION — accès à la base de données
   =============================================================
   Le backend PHP utilise l'API REST officielle de Notion via cURL
   pour lire et écrire dans 4 bases :
   - Comptes LearnWithUs       (utilisateurs et mots de passe hashés)
   - CRM LearnWithUs           (pipeline prospects → clients)
   - Transactions LearnWithUs  (historique des paiements Premium)
   - Inscriptions Formations   (legacy, plus alimentée)
   ============================================================= */

/* Token d'intégration Notion (commence par "ntn_" ou "secret_").
   À créer sur https://www.notion.so/my-integrations puis à
   "partager" avec chacune des 4 bases (bouton "Share" → ajouter
   l'intégration). Sans ça, l'API renvoie des 404. */
const NOTION_TOKEN = 'ntn_VOTRE_TOKEN_NOTION_ICI';

/* Database ID de la base "Comptes LearnWithUs" — utilisé par
   /api/creer-compte.php (crée la page avec parent.database_id). */
const NOTION_DATABASE_COMPTES_ID = 'xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx';

/* Data source IDs — requis pour les requêtes (depuis l'API
   Notion 2025-09-03, on interroge les data sources, pas les
   databases directement). On les trouve dans l'URL de la base
   en mode "vue par défaut". */
const NOTION_DS_COMPTES_ID       = 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx';
const NOTION_DS_CRM_ID           = 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx';
const NOTION_DS_TRANSACTIONS_ID  = 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx';
const NOTION_DS_INSCRIPTIONS_ID  = 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx';


/* =============================================================
   2. n8n — automatisations email
   =============================================================
   5 workflows configurés sur n8n.cloud. Chacun expose un webhook
   HTTP que le backend PHP appelle via cURL (fire-and-forget).
   Si une URL est vide, le backend continue de fonctionner mais
   l'email correspondant n'est pas envoyé.
   ============================================================= */

/* Workflow #1 — Bienvenue : déclenché à la création de compte.
   Envoie un email de bienvenue avec le lien de vérification. */
const WEBHOOK_N8N_BIENVENUE  = '';

/* Workflow #2 — Contact : accusé de réception au visiteur +
   notification à l'équipe. */
const WEBHOOK_N8N_CONTACT    = '';

/* Workflow #4 — Paiement : envoi du reçu Premium au client +
   notification à l'équipe. */
const WEBHOOK_N8N_PAIEMENT   = '';

/* Workflow #5 — Reset mot de passe : envoie un lien sécurisé
   valable 15 minutes pour réinitialiser le mot de passe. */
const WEBHOOK_N8N_RESET_MDP  = '';


/* =============================================================
   3. ADMINISTRATEURS
   =============================================================
   Liste des emails ayant accès au dashboard admin et aux routes
   /api/admin/*.php. Séparés par des virgules. La comparaison est
   faite en lower-case par la fonction estAdmin().
   ============================================================= */
const ADMIN_EMAILS = 'admin1@example.com,admin2@example.com';


/* =============================================================
   4. SECRET DE SIGNATURE HMAC
   =============================================================
   Utilisé pour signer les tokens stateless envoyés par email :
   - Tokens de reset mot de passe (purpose='reset', durée 15 min)
   - Tokens de vérification email (purpose='verification', 7 j)

   Doit être une chaîne aléatoire d'au moins 32 caractères.
   Pour en générer une rapidement :
       php -r "echo bin2hex(random_bytes(32));"
   ============================================================= */
const APP_SECRET = 'a-remplacer-par-une-chaine-aleatoire-de-32-caracteres-minimum';


/* =============================================================
   5. URL DU SITE
   =============================================================
   Utilisée pour construire les liens absolus dans les emails
   (vérification email, reset mot de passe).

   - Local MAMP   : http://localhost:8888
   - Prod IONOS   : https://learnwithus.fr
   ============================================================= */
const URL_SITE = 'http://localhost:8888';


/* =============================================================
   6. INITIALISATION DE LA SESSION PHP
   =============================================================
   Démarre la session de manière sécurisée :
   - cookie HttpOnly (pas accessible au JavaScript, anti-XSS)
   - cookie Secure si HTTPS (transmis uniquement en TLS)
   - SameSite=Lax (protection basique contre les CSRF)
   - durée de vie : 7 jours

   À appeler au début de chaque route qui a besoin de
   l'utilisateur connecté (creer-compte, connexion, ...).
   ============================================================= */
function demarrerSession() {
    if (session_status() === PHP_SESSION_NONE) {
        $estHttps = !empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off';
        session_start([
            'cookie_lifetime' => 7 * 24 * 60 * 60,  /* 7 jours */
            'cookie_secure'   => $estHttps,         /* true en HTTPS uniquement */
            'cookie_httponly' => true,              /* protège contre le vol via JS */
            'cookie_samesite' => 'Lax'              /* protège contre les CSRF basiques */
        ]);
    }
}
