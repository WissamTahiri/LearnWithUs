<?php
/* =============================================================
   api/admin/supprimer-compte.php — Admin archive un compte
   =============================================================
   Permet à un admin d'archiver le compte de n'importe quel
   utilisateur. Refuse si l'admin tente de supprimer son propre
   compte (utiliser /api/supprimer-compte.php pour ça).
   ============================================================= */

require_once __DIR__ . '/../_init.php';
require_once __DIR__ . '/../../helpers/auth.php';
require_once __DIR__ . '/../../helpers/comptes.php';
require_once __DIR__ . '/../../helpers/notion.php';

exigerMethode('POST');
$admin = exigerAdmin();

$d          = lireRequete();
$emailCible = strtolower(trim($d['email'] ?? ''));

if (!$emailCible) {
    repondreJson(['succes' => false, 'message' => 'Email obligatoire'], 400);
}

if ($emailCible === strtolower($admin['email'])) {
    repondreJson([
        'succes'  => false,
        'message' => 'Vous ne pouvez pas supprimer votre propre compte via cette route'
    ], 400);
}

$page = chercherCompteParEmail($emailCible);
if (!$page) {
    repondreJson(['succes' => false, 'message' => 'Compte introuvable'], 404);
}

$archive = appelerNotion('PATCH', 'pages/' . $page['id'], ['archived' => true]);
if (!$archive) {
    repondreJson(['succes' => false, 'message' => 'Erreur lors de la suppression'], 500);
}

repondreJson([
    'succes'  => true,
    'message' => 'Compte de ' . $emailCible . ' supprimé'
]);
