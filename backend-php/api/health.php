<?php
/* =============================================================
   api/health.php — Sonde de santé du backend
   =============================================================
   Renvoie un JSON simple indiquant que le serveur répond.
   Utilisée pour vérifier rapidement que MAMP / IONOS sert PHP.
   URL : http://localhost:8888/backend-php/api/health.php
   ============================================================= */

require_once __DIR__ . '/_init.php';

repondreJson([
    'statut'  => 'ok',
    'service' => 'LearnWithUs API (PHP)',
    'heure'   => date('c')   /* date ISO 8601 */
]);
