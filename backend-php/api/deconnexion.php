<?php
/* =============================================================
   api/deconnexion.php — Détruit la session courante
   ============================================================= */

require_once __DIR__ . '/_init.php';
require_once __DIR__ . '/../helpers/auth.php';

deconnecterUtilisateur();

repondreJson([
    'succes'  => true,
    'message' => 'Vous êtes déconnecté'
]);
