/* =============================================================
   api/_lib/crm.js — Synchronisation du CRM Notion (upsert)
   =============================================================
   Equivalent Node de backend-php/helpers/crm.php. Une seule
   entree par email : si l'email existe deja -> mise a jour
   pipeline + derniere action UNIQUEMENT (Source n'est JAMAIS
   reecrite a la mise a jour, comportement volontaire preserve) ;
   sinon -> creation avec Pipeline='Lead' par defaut.
   Appelee depuis : contact, creer-compte, activer-premium,
   admin/changer-statut.
   ============================================================= */

const { chercherPageNotion, appelerNotion } = require('./notion');

function chercherContactCRM(email) {
  return chercherPageNotion(process.env.NOTION_DS_CRM_ID, {
    property: 'Email',
    email: { equals: email },
  });
}

/* Cree ou met a jour un contact dans le CRM.
   donnees attend les cles : nomComplet, email, source (opt),
   formation (opt), pipeline (opt). */
async function synchroniserCRM(donnees) {
  if (!process.env.NOTION_DS_CRM_ID) {
    console.error('[CRM] NOTION_DS_CRM_ID non configure, sync ignoree');
    return;
  }

  const email = donnees.email || '';
  if (!email) return;

  const aujourdhui = new Date().toISOString().slice(0, 10);
  const existant = await chercherContactCRM(email);

  if (existant) {
    const maj = {
      'Dernière action': { date: { start: aujourdhui } },
    };
    if (donnees.pipeline) {
      maj.Pipeline = { select: { name: donnees.pipeline } };
    }
    await appelerNotion('PATCH', 'pages/' + existant.id, { properties: maj });
  } else {
    const props = {
      'Nom complet': { title: [{ text: { content: donnees.nomComplet || email } }] },
      Email: { email },
      Source: { select: { name: donnees.source || 'Autre' } },
      Pipeline: { select: { name: donnees.pipeline || 'Lead' } },
      'Date 1er contact': { date: { start: aujourdhui } },
      'Dernière action': { date: { start: aujourdhui } },
    };
    if (donnees.formation) {
      props["Formation d'intérêt"] = { select: { name: donnees.formation } };
    }

    await appelerNotion('POST', 'pages', {
      parent: { data_source_id: process.env.NOTION_DS_CRM_ID },
      properties: props,
    });
  }
}

module.exports = { chercherContactCRM, synchroniserCRM };
