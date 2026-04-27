<?php
/* =============================================================
   api/_init.php — Bootstrap commun à toutes les routes API
   =============================================================
   À inclure (require_once) en haut de chaque fichier de route.
   - Charge la config (constantes Notion, URLs n8n, etc.)
   - Force le Content-Type JSON pour la réponse
   - Fournit une fonction lireRequete() qui supporte JSON & form
   ============================================================= */

require_once __DIR__ . '/../config.php';

/* Toutes nos routes répondent en JSON */
header('Content-Type: application/json; charset=utf-8');


/* Lit le corps de la requête et renvoie un tableau associatif.
   Supporte 2 formats :
   - JSON  (Content-Type: application/json) → fetch(..., body: JSON)
   - Form  (application/x-www-form-urlencoded) → <form method=POST>
   Cela nous permet de mixer formulaires HTML classiques et fetch. */
function lireRequete() {
    $contentType = $_SERVER['CONTENT_TYPE'] ?? '';

    if (stripos($contentType, 'application/json') !== false) {
        $brut = file_get_contents('php://input');
        $decode = json_decode($brut, true);
        return is_array($decode) ? $decode : [];
    }

    return $_POST;
}


/* Réponse JSON standardisée + arrêt du script.
   - $code    : code HTTP (200 par défaut)
   - $payload : tableau associatif renvoyé en JSON */
function repondreJson($payload, $code = 200) {
    http_response_code($code);
    echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}


/* Vérifie que la méthode HTTP de la requête correspond à $attendu.
   Ex : exigerMethode('POST') refuse les GET avec un 405. */
function exigerMethode($attendu) {
    if ($_SERVER['REQUEST_METHOD'] !== $attendu) {
        repondreJson(['succes' => false, 'message' => 'Méthode non autorisée'], 405);
    }
}
