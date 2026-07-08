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

/* Anti-bruteforce à DEUX niveaux (localhost exempté, voir rate-limit.php) :
   - par IP + email (10 / 15 min) : protège UN compte ciblé sans bloquer les
     autres utilisateurs derrière une IP partagée (salle de classe / NAT) ;
   - par IP seule (40 / 15 min) : plafond global qui freine le credential
     stuffing (un bot qui teste des dizaines d'emails différents depuis la
     même IP). Seuil généreux pour tolérer une classe entière, mais très en
     dessous des centaines de tentatives d'une attaque automatisée.
   On appelle les DEUX avant le test pour qu'ils enregistrent leur tentative. */
$ipOk    = verifierRateLimit('connexion-ip-' . obtenirIp(), 40, 900);
$emailOk = verifierRateLimit('connexion-' . obtenirIp() . '-' . $email, 10, 900);
if (!$ipOk || !$emailOk) {
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
    /* Anti-énumération par timing : on exécute quand même un password_verify
       contre un hash bcrypt factice (même coût 10) pour que la réponse mette
       le même temps qu'un compte existant. Sinon, une réponse trop rapide
       trahit l'absence de compte. */
    password_verify($mdp, '$2y$10$iz7Nvuv/tUDSgVBlwxaJ9..wYnlV.9gan4ZSNECOGkgovDk8mD9Cm');
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
