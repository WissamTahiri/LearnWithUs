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
if (strlen($mdp) < 8 || !preg_match('/[A-Z]/', $mdp) || !preg_match('/[0-9]/', $mdp)) {
    repondreJson([
        'succes'  => false,
        'message' => 'Le mot de passe doit faire au moins 8 caractères, avec une majuscule et un chiffre'
    ], 400);
}

/* === Vérifie que le domaine a un serveur mail (MX) ===
   Seul le MX prouve qu'un domaine reçoit vraiment des emails. Un simple
   enregistrement A (page web) ne suffit pas : beaucoup de domaines
   enregistrés mais jamais configurés pour le mail en ont un quand même
   (page de parking du registrar) — accepter le A seul laissait passer
   ces domaines "coquille vide". Bloque AVANT tout déclenchement n8n. */
$domaine = substr(strrchr($email, '@'), 1);
if (!$domaine || !checkdnsrr($domaine, 'MX')) {
    repondreJson([
        'succes'  => false,
        'message' => "Cette adresse email semble introuvable : vérifiez le domaine."
    ], 422);
}

/* === Refus des adresses email jetables / temporaires ===
   Ces domaines (yopmail, mailinator...) ont un vrai MX et passent donc le
   test DNS ci-dessus : on les bloque explicitement. Refuser l'inscription
   = pas de compte, donc pas d'accès au site ni au paiement. Liste à éditer. */
$domainesJetables = [
    'yopmail.com', 'yopmail.fr', 'mailinator.com', 'guerrillamail.com',
    'guerrillamail.info', 'sharklasers.com', '10minutemail.com', 'temp-mail.org',
    'tempmail.com', 'tempmailo.com', 'minuteinbox.com', 'throwawaymail.com',
    'getnada.com', 'trashmail.com', 'maildrop.cc', 'mailcatch.com',
    'fakeinbox.com', 'dispostable.com', 'mintemail.com', 'mohmal.com',
    'jetable.org', 'moakt.com', 'mailsac.com', 'discard.email',
    'emailondeck.com', 'spam4.me', 'tempr.email', '33mail.com',
];
if (in_array($domaine, $domainesJetables, true)) {
    repondreJson([
        'succes'  => false,
        'message' => "Les adresses email temporaires ne sont pas acceptées. Utilisez une adresse personnelle ou professionnelle."
    ], 422);
}

/* Anti-bruteforce : 10 tentatives / 15 min par IP + email (localhost exempté). */
if (!verifierRateLimit('creer-' . obtenirIp() . '-' . $email, 10, 900)) {
    repondreJson([
        'succes'  => false,
        'message' => 'Trop de tentatives, réessayez dans 15 minutes.'
    ], 429);
}

/* === Verrou anti-doublon (2 inscriptions simultanées, même email) ===
   Sans verrou, deux requêtes qui arrivent en même temps peuvent CHACUNE
   passer le test "email déjà utilisé" avant que l'autre n'ait fini de
   créer son compte (Notion n'a pas de contrainte d'unicité comme une
   vraie base SQL) → 2 comptes en doublon. Le flock force les requêtes
   sur le MÊME email à s'exécuter une par une. */
$dossierData = __DIR__ . '/../data';
if (!is_dir($dossierData)) mkdir($dossierData, 0755, true);
$verrou = fopen($dossierData . '/lock-creation-' . md5($email) . '.lock', 'c');
flock($verrou, LOCK_EX);

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

/* Compte créé : on relâche le verrou tout de suite (pas besoin de
   bloquer les autres requêtes pendant CRM/webhook/session ci-dessous). */
flock($verrou, LOCK_UN);
fclose($verrou);

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
