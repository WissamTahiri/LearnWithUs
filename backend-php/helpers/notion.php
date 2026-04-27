<?php
/* =============================================================
   helpers/notion.php — Wrapper léger pour l'API Notion
   =============================================================
   Notion expose une API REST classique : on l'appelle avec cURL
   (extension PHP standard, présente sur tous les hébergeurs).
   Aucune librairie externe nécessaire.
   ============================================================= */

require_once __DIR__ . '/../config.php';


/* Appelle l'API Notion (version 2025-09-03).
   - $methode  : 'GET' / 'POST' / 'PATCH' / 'DELETE'
   - $endpoint : ex 'pages', 'pages/abc-123', 'data_sources/xyz/query'
   - $donnees  : tableau associatif (sera envoyé en JSON) ou null
   Retourne le tableau associatif décodé, ou null si HTTP >= 400. */
function appelerNotion($methode, $endpoint, $donnees = null) {

    $url = 'https://api.notion.com/v1/' . $endpoint;
    $ch  = curl_init($url);

    /* On configure cURL avec les en-têtes attendus par Notion */
    curl_setopt_array($ch, [
        CURLOPT_HTTPHEADER => [
            'Authorization: Bearer ' . NOTION_TOKEN,
            'Notion-Version: 2025-09-03',
            'Content-Type: application/json'
        ],
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_CUSTOMREQUEST  => $methode,
        CURLOPT_TIMEOUT        => 15
    ]);

    /* Si on envoie des données (POST / PATCH), on les sérialise en JSON */
    if ($donnees !== null) {
        curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($donnees));
    }

    $reponse = curl_exec($ch);
    $code    = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    /* Erreur réseau ou HTTP >= 400 : on log et on renvoie null */
    if ($reponse === false || $code >= 400) {
        error_log('[Notion] ' . $methode . ' ' . $endpoint . ' → HTTP ' . $code . ' — ' . $reponse);
        return null;
    }

    return json_decode($reponse, true);
}


/* Cherche la première page d'une data source qui matche un filtre.
   Retourne la page Notion (tableau associatif) ou null si aucune. */
function chercherPageNotion($dataSourceId, $filtre) {
    $reponse = appelerNotion(
        'POST',
        'data_sources/' . $dataSourceId . '/query',
        ['filter' => $filtre]
    );
    return $reponse['results'][0] ?? null;
}


/* Récupère TOUTES les pages d'une data source (paginé en interne).
   Pour un projet école on suppose < 1000 pages par base. */
function listerPagesNotion($dataSourceId) {
    $toutes = [];
    $cursor = null;
    do {
        $corps = ['page_size' => 100];
        if ($cursor) $corps['start_cursor'] = $cursor;

        $reponse = appelerNotion(
            'POST',
            'data_sources/' . $dataSourceId . '/query',
            $corps
        );
        if (!$reponse) break;

        $toutes = array_merge($toutes, $reponse['results'] ?? []);
        $cursor = !empty($reponse['has_more']) ? $reponse['next_cursor'] : null;
    } while ($cursor);

    return $toutes;
}
