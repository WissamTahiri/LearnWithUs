<?php
/* =============================================================
   api/connexion.php — Connexion utilisateur
   =============================================================
   1. Cherche le compte par email (Notion)
   2. Vérifie le mot de passe (password_verify contre le hash bcrypt)
   3. Met à jour la "Derniere connexion" dans Notion
   4. Ouvre la session PHP (connecterUtilisateur)
   ============================================================= */

require_once __DIR__ . '/_init.php';
require_once __DIR__ . '/../helpers/comptes.php';
require_once __DIR__ . '/../helpers/auth.php';
require_once __DIR__ . '/../helpers/rate-limit.php';
require_once __DIR__ . '/../helpers/notion.php';

exigerMethode('POST');

$d     = lireRequete();
$email = strtolower(trim($d['email'] ?? ''));
$mdp   = $d['motDePasse']             ?? '';

/* Anti-bruteforce : 10 tentatives / 15 min par IP + email. Clé par email
   pour qu'un utilisateur derrière une IP partagée (salle de classe / NAT)
   ne bloque pas les autres. Localhost est exempté (voir rate-limit.php). */
if (!verifierRateLimit('connexion-' . obtenirIp() . '-' . $email, 10, 900)) {
    repondreJson([
        'succes'  => false,
        'message' => 'Trop de tentatives, réessayez dans 15 minutes.'
    ], 429);
}

if (!$email || !$mdp) {
    repondreJson([
        'succes'  => false,
        'message' => 'Email et mot de passe obligatoires'
    ], 400);
}

$page = chercherCompteParEmail($email);
if (!$page) {
    repondreJson([
        'succes'  => false,
        'message' => 'Email ou mot de passe incorrect'
    ], 401);
}

$compte = lireCompte($page);

/* Comparaison du mdp fourni au hash bcrypt stocké */
if (!password_verify($mdp, $compte['hash'])) {
    repondreJson([
        'succes'  => false,
        'message' => 'Email ou mot de passe incorrect'
    ], 401);
}

/* Mise à jour de "Derniere connexion" (silencieux si erreur) */
appelerNotion('PATCH', 'pages/' . $compte['id'], [
    'properties' => [
        'Derniere connexion' => ['date' => ['start' => date('c')]]
    ]
]);

/* Ouverture de la session */
$utilisateur = [
    'email'  => $compte['email'],
    'prenom' => $compte['prenom'],
    'nom'    => $compte['nom'],
    'statut' => $compte['statut']
];
connecterUtilisateur($utilisateur);

repondreJson([
    'succes'      => true,
    'message'     => 'Connexion réussie',
    'utilisateur' => array_merge($utilisateur, ['estAdmin' => estAdmin($email)])
]);
