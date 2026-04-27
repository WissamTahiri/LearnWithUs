<?php
/* =============================================================
   helpers/auth.php — Sessions & autorisations
   =============================================================
   Tout passe par les sessions PHP natives ($_SESSION).
   - connecterUtilisateur()    → ouvre la session après login
   - deconnecterUtilisateur()  → détruit la session
   - utilisateurConnecte()     → retourne l'utilisateur ou null
   - exigerConnexion()         → bloque (401) si non connecté
   - exigerAdmin()             → bloque (403) si non admin
   ============================================================= */

require_once __DIR__ . '/../config.php';
require_once __DIR__ . '/../api/_init.php';


/* Vérifie si un email est dans la liste ADMIN_EMAILS (case-insensitive). */
function estAdmin($email) {
    if (!$email) return false;
    $liste = array_map('trim', array_map('strtolower', explode(',', ADMIN_EMAILS)));
    return in_array(strtolower($email), $liste, true);
}


/* Retourne l'utilisateur connecté (tableau associatif) ou null. */
function utilisateurConnecte() {
    demarrerSession();
    return $_SESSION['utilisateur'] ?? null;
}


/* Enregistre l'utilisateur dans la session.
   À appeler après une création de compte ou une connexion réussie. */
function connecterUtilisateur($utilisateur) {
    demarrerSession();
    /* Régénère l'ID de session pour empêcher la "session fixation" :
       un attaquant ne peut pas réutiliser un ID de session pré-connexion. */
    session_regenerate_id(true);
    $utilisateur['estAdmin'] = estAdmin($utilisateur['email'] ?? '');
    $_SESSION['utilisateur'] = $utilisateur;
}


/* Détruit complètement la session courante. */
function deconnecterUtilisateur() {
    demarrerSession();
    $_SESSION = [];
    /* Supprime aussi le cookie côté navigateur */
    if (ini_get('session.use_cookies')) {
        $params = session_get_cookie_params();
        setcookie(session_name(), '', time() - 42000,
            $params['path'], $params['domain'],
            $params['secure'], $params['httponly']
        );
    }
    session_destroy();
}


/* Renvoie l'utilisateur connecté ou stoppe la requête avec 401. */
function exigerConnexion() {
    $u = utilisateurConnecte();
    if (!$u) {
        repondreJson([
            'succes'  => false,
            'message' => 'Authentification requise'
        ], 401);
    }
    return $u;
}


/* Renvoie l'utilisateur si admin, sinon stoppe la requête avec 403. */
function exigerAdmin() {
    $u = exigerConnexion();
    if (empty($u['estAdmin'])) {
        repondreJson([
            'succes'  => false,
            'message' => 'Accès réservé à l\'équipe administration'
        ], 403);
    }
    return $u;
}
