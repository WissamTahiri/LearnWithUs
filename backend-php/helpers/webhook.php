<?php
/* =============================================================
   helpers/webhook.php — Appel d'un webhook n8n
   =============================================================
   Les workflows n8n se déclenchent via une URL HTTP : on envoie
   un POST JSON, n8n reçoit, et lance le workflow (envoi d'email).
   ============================================================= */


/* Appelle un webhook n8n avec un payload JSON.
   - $url     : URL du webhook (laisser vide pour ignorer silencieusement)
   - $donnees : tableau associatif envoyé en JSON
   Retourne true si HTTP < 400, false sinon. */
function appelerWebhook($url, $donnees) {

    /* Si l'URL n'est pas configurée, on saute (mode dev sans n8n) */
    if (!$url) {
        error_log('[Webhook] URL non configurée, appel ignoré');
        return false;
    }

    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_POST           => true,
        CURLOPT_HTTPHEADER     => ['Content-Type: application/json'],
        CURLOPT_POSTFIELDS     => json_encode($donnees),
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT        => 10
    ]);

    $reponse = curl_exec($ch);
    $code    = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    if ($reponse === false || $code >= 400) {
        error_log('[Webhook] ' . $url . ' → HTTP ' . $code);
        return false;
    }
    return true;
}
