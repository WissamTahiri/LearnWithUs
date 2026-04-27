<?php
/* =============================================================
   api/admin/changer-statut.php — Admin bascule Standard ↔ Premium
   =============================================================
   Geste commercial / résiliation anticipée — sans déclencher
   de webhook (silent update).
   ============================================================= */

require_once __DIR__ . '/../_init.php';
require_once __DIR__ . '/../../helpers/auth.php';
require_once __DIR__ . '/../../helpers/comptes.php';
require_once __DIR__ . '/../../helpers/notion.php';

exigerMethode('POST');
exigerAdmin();

$d             = lireRequete();
$emailCible    = strtolower(trim($d['email'] ?? ''));
$nouveauStatut = trim($d['nouveauStatut'] ?? '');

if (!$emailCible) {
    repondreJson(['succes' => false, 'message' => 'Email obligatoire'], 400);
}

if (!in_array($nouveauStatut, ['Standard', 'Premium'], true)) {
    repondreJson([
        'succes'  => false,
        'message' => 'Statut invalide (Standard ou Premium attendu)'
    ], 400);
}

$page = chercherCompteParEmail($emailCible);
if (!$page) {
    repondreJson(['succes' => false, 'message' => 'Compte introuvable'], 404);
}

$maj = appelerNotion('PATCH', 'pages/' . $page['id'], [
    'properties' => ['Statut' => ['select' => ['name' => $nouveauStatut]]]
]);

if (!$maj) {
    repondreJson(['succes' => false, 'message' => 'Erreur lors du changement de statut'], 500);
}

repondreJson([
    'succes'  => true,
    'message' => 'Statut mis à jour : ' . $nouveauStatut
]);
