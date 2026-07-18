/* =============================================================
   api/_lib/notion.js — Wrapper leger pour l'API Notion
   =============================================================
   Equivalent Node de backend-php/helpers/notion.php.
   fetch natif (Node 18+) remplace cURL. Aucune librairie externe.
   ============================================================= */

const NOTION_VERSION = '2025-09-03';

/* Appelle l'API Notion.
   - methode  : 'GET' / 'POST' / 'PATCH' / 'DELETE'
   - endpoint : ex 'pages', 'pages/abc-123', 'data_sources/xyz/query'
   - donnees  : objet (sera envoye en JSON) ou null
   Retourne l'objet decode, ou null si HTTP >= 400 ou erreur reseau. */
async function appelerNotion(methode, endpoint, donnees = null) {
  const url = 'https://api.notion.com/v1/' + endpoint;

  let reponse;
  try {
    reponse = await fetch(url, {
      method: methode,
      headers: {
        Authorization: 'Bearer ' + process.env.NOTION_TOKEN,
        'Notion-Version': NOTION_VERSION,
        'Content-Type': 'application/json',
      },
      body: donnees !== null ? JSON.stringify(donnees) : undefined,
      signal: AbortSignal.timeout(15000),
    });
  } catch (e) {
    console.error('[Notion] ' + methode + ' ' + endpoint + ' -> erreur reseau : ' + e.message);
    return null;
  }

  if (!reponse.ok) {
    const texte = await reponse.text().catch(() => '');
    console.error('[Notion] ' + methode + ' ' + endpoint + ' -> HTTP ' + reponse.status + ' - ' + texte);
    return null;
  }

  return reponse.json();
}

/* Cherche la premiere page d'une data source qui matche un filtre.
   Retourne la page (objet) ou null si aucune. */
async function chercherPageNotion(dataSourceId, filtre) {
  const reponse = await appelerNotion('POST', 'data_sources/' + dataSourceId + '/query', {
    filter: filtre,
  });
  return (reponse && reponse.results && reponse.results[0]) || null;
}

/* Recupere TOUTES les pages d'une data source (paginee en interne).
   Pour un projet ecole on suppose < 1000 pages par base. */
async function listerPagesNotion(dataSourceId) {
  const toutes = [];
  let cursor = null;

  do {
    const corps = { page_size: 100 };
    if (cursor) corps.start_cursor = cursor;

    const reponse = await appelerNotion('POST', 'data_sources/' + dataSourceId + '/query', corps);
    if (!reponse) break;

    toutes.push(...(reponse.results || []));
    cursor = reponse.has_more ? reponse.next_cursor : null;
  } while (cursor);

  return toutes;
}

module.exports = { appelerNotion, chercherPageNotion, listerPagesNotion };
