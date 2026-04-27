<?php
/* =============================================================
   api/verifier-email.php — Vérification d'email (lien bienvenue)
   =============================================================
   Confirme qu'un visiteur a cliqué sur le lien envoyé à la
   création de compte. Pour un projet école on ne stocke pas
   l'état "vérifié" (on ne bloque aucune fonctionnalité dessus),
   mais valider la signature démontre la démarche RGPD/sécurité.
   ============================================================= */

require_once __DIR__ . '/_init.php';
require_once __DIR__ . '/../helpers/token.php';

exigerMethode('GET');

$token = $_GET['token'] ?? '';
if (!$token) {
    repondreJson(['succes' => false, 'message' => 'Token manquant'], 400);
}

$payload = verifierToken($token, 'verification');
if (!$payload) {
    repondreJson([
        'succes'  => false,
        'message' => 'Lien de vérification invalide ou expiré'
    ], 400);
}

repondreJson([
    'succes' => true,
    'email'  => $payload['email']
]);
