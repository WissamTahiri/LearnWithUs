<?php
/* =============================================================
   api/mdp-confirmer.php — Confirmation du nouveau mot de passe
   =============================================================
   1. Vérifie le token reçu par email (signature + expiration + purpose)
   2. Met à jour le hash bcrypt dans Notion
   ============================================================= */

require_once __DIR__ . '/_init.php';
require_once __DIR__ . '/../helpers/comptes.php';
require_once __DIR__ . '/../helpers/notion.php';
require_once __DIR__ . '/../helpers/token.php';
require_once __DIR__ . '/../helpers/rate-limit.php';

exigerMethode('POST');

/* Anti-bruteforce : 5 tentatives / 15 min par IP. Empêche un
   attaquant de forger des tokens et de tester massivement. */
if (!verifierRateLimit('mdp-confirmer-' . obtenirIp())) {
    repondreJson([
        'succes'  => false,
        'message' => 'Trop de tentatives, réessayez dans 15 minutes.'
    ], 429);
}

$d          = lireRequete();
$token      = $d['token']      ?? '';
$nouveauMdp = $d['nouveauMdp'] ?? '';

if (!$token || !$nouveauMdp) {
    repondreJson([
        'succes'  => false,
        'message' => 'Token et nouveau mot de passe obligatoires'
    ], 400);
}

if (strlen($nouveauMdp) < 8 || !preg_match('/[A-Z]/', $nouveauMdp) || !preg_match('/[0-9]/', $nouveauMdp)) {
    repondreJson([
        'succes'  => false,
        'message' => 'Le mot de passe doit faire au moins 8 caractères, avec une majuscule et un chiffre'
    ], 400);
}

/* Vérifie signature + expiration + purpose='reset' */
$payload = verifierToken($token, 'reset');
if (!$payload) {
    repondreJson([
        'succes'  => false,
        'message' => 'Lien invalide ou expiré (valable 15 minutes)'
    ], 400);
}

$page = chercherCompteParEmail($payload['email']);
if (!$page) {
    repondreJson(['succes' => false, 'message' => 'Compte introuvable'], 404);
}

$nouveauHash = password_hash($nouveauMdp, PASSWORD_BCRYPT, ['cost' => 10]);

$maj = appelerNotion('PATCH', 'pages/' . $page['id'], [
    'properties' => [
        'Mot de passe' => ['rich_text' => [['text' => ['content' => $nouveauHash]]]]
    ]
]);

if (!$maj) {
    repondreJson(['succes' => false, 'message' => 'Erreur lors de la mise à jour'], 500);
}

repondreJson([
    'succes'  => true,
    'message' => 'Mot de passe réinitialisé'
]);
