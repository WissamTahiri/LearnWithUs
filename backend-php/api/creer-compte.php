<?php
/* =============================================================
   api/creer-compte.php — Création d'un compte utilisateur
   =============================================================
   1. Validation des champs (prénom, nom, email, mdp >= 8 car.)
   2. Refus si l'email existe déjà
   3. Hash bcrypt natif (password_hash)
   4. Création de la page dans la base Notion "Comptes"
   5. Sync CRM Notion (Pipeline=Lead, Source=Création compte)
   6. Webhook n8n bienvenue (email simple, sans lien de vérif)
   7. Connexion automatique (session PHP)
   ============================================================= */

require_once __DIR__ . '/_init.php';
require_once __DIR__ . '/../helpers/comptes.php';
require_once __DIR__ . '/../helpers/auth.php';
require_once __DIR__ . '/../helpers/rate-limit.php';
require_once __DIR__ . '/../helpers/webhook.php';
require_once __DIR__ . '/../helpers/crm.php';

exigerMethode('POST');

/* Anti-bruteforce : 5 tentatives / 15 min par IP */
if (!verifierRateLimit('creer-' . obtenirIp())) {
    repondreJson([
        'succes'  => false,
        'message' => 'Trop de tentatives, réessayez dans 15 minutes.'
    ], 429);
}

$d         = lireRequete();
$prenom    = trim($d['prenom']     ?? '');
$nom       = trim($d['nom']        ?? '');
$email     = strtolower(trim($d['email'] ?? ''));
$mdp       = $d['motDePasse']      ?? '';
$formation = trim($d['formation']  ?? '');

/* === Validations === */
if (!$prenom || !$nom || !$email || !$mdp) {
    repondreJson([
        'succes'  => false,
        'message' => 'Prénom, nom, email et mot de passe sont obligatoires'
    ], 400);
}
if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    repondreJson(['succes' => false, 'message' => 'Email invalide'], 400);
}
if (strlen($mdp) < 8) {
    repondreJson([
        'succes'  => false,
        'message' => 'Le mot de passe doit faire au moins 8 caractères'
    ], 400);
}

/* === Refus si compte déjà existant === */
if (chercherCompteParEmail($email)) {
    repondreJson([
        'succes'  => false,
        'message' => 'Un compte existe déjà avec cet email'
    ], 409);
}

/* === Hash bcrypt natif === */
$hashe = password_hash($mdp, PASSWORD_BCRYPT, ['cost' => 10]);

/* === Création dans Notion === */
$creation = appelerNotion('POST', 'pages', [
    'parent' => ['database_id' => NOTION_DATABASE_COMPTES_ID],
    'properties' => [
        'Email'        => ['title'     => [['text' => ['content' => $email]]]],
        'Mot de passe' => ['rich_text' => [['text' => ['content' => $hashe]]]],
        'Prenom'       => ['rich_text' => [['text' => ['content' => $prenom]]]],
        'Nom'          => ['rich_text' => [['text' => ['content' => $nom]]]],
        'Statut'       => ['select'    => ['name' => 'Standard']]
    ]
]);

if (!$creation) {
    repondreJson([
        'succes'  => false,
        'message' => 'Erreur serveur lors de la création du compte'
    ], 500);
}

/* === Sync CRM (Pipeline=Lead, Source=Création compte) === */
synchroniserCRM([
    'nomComplet' => $prenom . ' ' . $nom,
    'email'      => $email,
    'formation'  => $formation ?: null,
    'source'     => 'Création compte',
    'pipeline'   => 'Lead'
]);

/* === Email de bienvenue via n8n === */
if (WEBHOOK_N8N_BIENVENUE) {
    appelerWebhook(WEBHOOK_N8N_BIENVENUE, [
        'prenom'    => $prenom,
        'nom'       => $nom,
        'email'     => $email,
        'formation' => $formation
    ]);
}

/* === Connexion automatique (session) === */
$utilisateur = [
    'email'  => $email,
    'prenom' => $prenom,
    'nom'    => $nom,
    'statut' => 'Standard'
];
connecterUtilisateur($utilisateur);

repondreJson([
    'succes'      => true,
    'message'     => 'Compte créé avec succès',
    'utilisateur' => array_merge($utilisateur, ['estAdmin' => estAdmin($email)])
]);
