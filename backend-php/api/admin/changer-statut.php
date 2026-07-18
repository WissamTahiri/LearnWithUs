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
require_once __DIR__ . '/../../helpers/crm.php';

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

/* === Aligne le CRM sur le nouveau statut ===
   Sans cette synchro, un compte passe Premium par l'admin restait "Lead"
   dans le CRM : le pipeline n'etait mis a jour que par le paiement en
   self-service. Premium -> Client Premium ; retour Standard -> Client. */
$compte = lireCompte($page);
synchroniserCRM([
    'email'      => $emailCible,
    'nomComplet' => (trim(($compte['prenom'] ?? '') . ' ' . ($compte['nom'] ?? '')) ?: $emailCible),
    'pipeline'   => $nouveauStatut === 'Premium' ? 'Client Premium' : 'Client'
]);

repondreJson([
    'succes'  => true,
    'message' => 'Statut mis à jour : ' . $nouveauStatut
]);
