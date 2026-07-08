<?php
/* =============================================================
   api/mdp-demande.php — Demande de réinitialisation mdp
   =============================================================
   1. Cherche le compte par email (silencieux si absent pour
      éviter l'énumération de comptes)
   2. Génère un token HMAC valable 15 minutes (purpose='reset')
   3. Construit un lien et l'envoie via le webhook n8n #5
   4. Réponse toujours générique (ne révèle pas si l'email existe)
   ============================================================= */

require_once __DIR__ . '/_init.php';
require_once __DIR__ . '/../helpers/comptes.php';
require_once __DIR__ . '/../helpers/rate-limit.php';
require_once __DIR__ . '/../helpers/token.php';
require_once __DIR__ . '/../helpers/webhook.php';

exigerMethode('POST');

$d     = lireRequete();
$email = strtolower(trim($d['email'] ?? ''));

if (!verifierRateLimit('mdp-demande-' . obtenirIp() . '-' . $email, 10, 900)) {
    repondreJson([
        'succes'  => false,
        'message' => 'Trop de tentatives, réessayez dans 15 minutes.'
    ], 429);
}

if (!$email) {
    repondreJson(['succes' => false, 'message' => 'Email obligatoire'], 400);
}

$page = chercherCompteParEmail($email);

if ($page) {
    $compte = lireCompte($page);

    /* Empreinte du hash actuel : lie le token au mot de passe courant, ce qui
       rend le lien À USAGE UNIQUE (dès que le mdp change, tout lien émis avant
       devient invalide). */
    $empreinte = substr(hash('sha256', $compte['hash']), 0, 16);

    /* Token signé valable 15 minutes, lié au mot de passe actuel */
    $token = genererToken($compte['email'], 'reset', 15 * 60, $empreinte);
    $lien  = URL_SITE . '/reset-mot-de-passe.html?token=' . $token;

    if (WEBHOOK_N8N_RESET_MDP) {
        appelerWebhook(WEBHOOK_N8N_RESET_MDP, [
            'email'  => $compte['email'],
            'prenom' => $compte['prenom'],
            'lien'   => $lien
        ]);
    } else {
        /* Pas de webhook configuré : on log le lien côté serveur
           pour permettre les tests dev sans passer par n8n */
        error_log('[Reset] ' . $compte['email'] . ' → ' . $lien);
    }
}

/* Réponse volontairement générique (anti-énumération) */
repondreJson([
    'succes'  => true,
    'message' => 'Si un compte existe avec cet email, un lien de réinitialisation vient de partir.'
]);
