/* =============================================================
   api/_lib/webhook.js — Appel des webhooks n8n
   =============================================================
   Equivalent Node de backend-php/helpers/webhook.php. fetch
   natif remplace cURL. Fire-and-forget : no-op silencieux si
   l'URL n'est pas configuree (permet de dev sans n8n branche).
   ============================================================= */

async function appelerWebhook(url, donnees) {
  if (!url) {
    console.error('[Webhook] URL non configuree, appel ignore');
    return false;
  }

  try {
    const reponse = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(donnees),
      signal: AbortSignal.timeout(10000),
    });

    if (!reponse.ok) {
      console.error('[Webhook] ' + url + ' -> HTTP ' + reponse.status);
      return false;
    }
    return true;
  } catch (e) {
    console.error('[Webhook] ' + url + ' -> ' + e.message);
    return false;
  }
}

module.exports = { appelerWebhook };
