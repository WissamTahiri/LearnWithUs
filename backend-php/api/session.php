<?php
/* =============================================================
   api/session.php — Renvoie l'utilisateur connecté (ou null)
   =============================================================
   Appelée par le frontend au chargement de page pour savoir
   si la session est active et adapter la nav (pastille prénom,
   bouton déconnexion, lien admin si estAdmin, etc.)
   ============================================================= */

require_once __DIR__ . '/_init.php';
require_once __DIR__ . '/../helpers/auth.php';

$u = utilisateurConnecte();

repondreJson([
    'succes'      => true,
    'utilisateur' => $u   /* null si non connecté */
]);
