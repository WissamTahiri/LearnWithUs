<?php
/* =============================================================
   api/supprimer-compte.php — Suppression du compte (utilisateur)
   =============================================================
   Permet à un utilisateur connecté de supprimer son propre
   compte (droit à l'effacement RGPD).
   - On ARCHIVE la page Notion (soft delete) pour garder une
     trace technique
   - On NE supprime PAS l'entrée CRM : on conserve l'historique
     du lead pour la comptabilité
   - On détruit la session (déconnexion automatique)
   ============================================================= */

require_once __DIR__ . '/_init.php';
require_once __DIR__ . '/../helpers/auth.php';
require_once __DIR__ . '/../helpers/comptes.php';
require_once __DIR__ . '/../helpers/notion.php';

exigerMethode('POST');   /* On utilise POST plutôt que DELETE pour
                            faciliter les formulaires HTML classiques */

$utilisateur = exigerConnexion();
$email       = $utilisateur['email'];

$page = chercherCompteParEmail($email);
if (!$page) {
    repondreJson([
        'succes'  => false,
        'message' => 'Compte introuvable'
    ], 404);
}

/* Archive (soft delete) la page Notion */
$archive = appelerNotion('PATCH', 'pages/' . $page['id'], [
    'archived' => true
]);

if (!$archive) {
    repondreJson([
        'succes'  => false,
        'message' => 'Erreur lors de la suppression du compte'
    ], 500);
}

/* Détruit la session (l'utilisateur est déconnecté) */
deconnecterUtilisateur();

repondreJson([
    'succes'  => true,
    'message' => 'Votre compte a bien été supprimé'
]);
