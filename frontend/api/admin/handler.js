/* =============================================================
   api/admin/handler.js — Regroupe les 3 routes admin
   =============================================================
   Vercel Hobby limite un deploiement a 12 fonctions serverless.
   Avec 1 fichier = 1 route, le projet en comptait 13 (deploiement
   en erreur : exceeded_serverless_functions_per_deployment). Les
   3 routes /api/admin/* sont donc fusionnees ici en UNE fonction,
   redirigees par vercel.json (rewrites) sans changer les URLs
   externes ni le comportement de chacune (aucune ligne de logique
   modifiee par rapport aux 3 fichiers d'origine).

   Dispatch sur le chemin d'origine (req.url), preserve par Vercel
   meme apres un rewrite (verifie dans la doc du routeur Vercel :
   la Lambda recoit le pathname ORIGINAL de la requete, pas la
   destination du rewrite).
   ============================================================= */

const { lireCorps, envoyerJson, exigerMethode, texte } = require('../_lib/http');
const { exigerAdmin } = require('../_lib/auth');
const { chercherCompteParEmail, lireCompte } = require('../_lib/comptes');
const { appelerNotion } = require('../_lib/notion');
const { synchroniserCRM } = require('../_lib/crm');
const { invaliderSessionsUtilisateur } = require('../_lib/cookie');
const { listerPagesNotion } = require('../_lib/notion');

/* --- api/admin/changer-statut.js (logique inchangee) --- */
async function changerStatut(req, res) {
  if (!exigerMethode(req, res, 'POST')) return;
  if (!(await exigerAdmin(req, res))) return;

  const d = lireCorps(req);
  const emailCible = texte(d.email).toLowerCase();
  const nouveauStatut = texte(d.nouveauStatut);

  if (!emailCible) {
    return envoyerJson(res, { succes: false, message: 'Email obligatoire' }, 400);
  }
  if (!['Standard', 'Premium'].includes(nouveauStatut)) {
    return envoyerJson(res, { succes: false, message: 'Statut invalide (Standard ou Premium attendu)' }, 400);
  }

  const page = await chercherCompteParEmail(emailCible);
  if (!page) {
    return envoyerJson(res, { succes: false, message: 'Compte introuvable' }, 404);
  }

  const maj = await appelerNotion('PATCH', 'pages/' + page.id, {
    properties: { Statut: { select: { name: nouveauStatut } } },
  });
  if (!maj) {
    return envoyerJson(res, { succes: false, message: 'Erreur lors du changement de statut' }, 500);
  }

  const compte = lireCompte(page);
  await synchroniserCRM({
    email: emailCible,
    nomComplet: (compte.prenom + ' ' + compte.nom).trim() || emailCible,
    pipeline: nouveauStatut === 'Premium' ? 'Client Premium' : 'Client',
  });

  await invaliderSessionsUtilisateur(emailCible);

  envoyerJson(res, { succes: true, message: 'Statut mis à jour : ' + nouveauStatut });
}

/* --- api/admin/supprimer-compte.js (logique inchangee) --- */
async function supprimerCompte(req, res) {
  if (!exigerMethode(req, res, 'POST')) return;
  const admin = await exigerAdmin(req, res);
  if (!admin) return;

  const d = lireCorps(req);
  const emailCible = texte(d.email).toLowerCase();

  if (!emailCible) {
    return envoyerJson(res, { succes: false, message: 'Email obligatoire' }, 400);
  }
  if (emailCible === admin.email.toLowerCase()) {
    return envoyerJson(res, {
      succes: false,
      message: 'Vous ne pouvez pas supprimer votre propre compte via cette route',
    }, 400);
  }

  const page = await chercherCompteParEmail(emailCible);
  if (!page) {
    return envoyerJson(res, { succes: false, message: 'Compte introuvable' }, 404);
  }

  const archive = await appelerNotion('PATCH', 'pages/' + page.id, { archived: true });
  if (!archive) {
    return envoyerJson(res, { succes: false, message: 'Erreur lors de la suppression' }, 500);
  }

  envoyerJson(res, { succes: true, message: 'Compte de ' + emailCible + ' supprimé' });
}

/* --- api/admin/stats.js (logique inchangee, contrat de sortie strict) --- */
function triRecent(a, b) {
  const ta = a.created_time || '';
  const tb = b.created_time || '';
  return tb > ta ? 1 : tb < ta ? -1 : 0;
}

async function stats(req, res) {
  if (!exigerMethode(req, res, 'GET')) return;
  if (!(await exigerAdmin(req, res))) return;

  const [comptes, crm, transactions] = await Promise.all([
    listerPagesNotion(process.env.NOTION_DS_COMPTES_ID),
    listerPagesNotion(process.env.NOTION_DS_CRM_ID),
    listerPagesNotion(process.env.NOTION_DS_TRANSACTIONS_ID),
  ]);

  comptes.sort(triRecent);
  crm.sort(triRecent);
  transactions.sort((a, b) => {
    const da = a.properties?.Date?.date?.start || a.created_time || '';
    const db = b.properties?.Date?.date?.start || b.created_time || '';
    return db > da ? 1 : db < da ? -1 : 0;
  });

  const comptesParStatut = { Standard: 0, Premium: 0 };
  for (const c of comptes) {
    const statut = c.properties?.Statut?.select?.name || 'Standard';
    if (statut === 'Premium') comptesParStatut.Premium++;
    else comptesParStatut.Standard++;
  }

  const crmParFormation = { IA: 0, SCRUM: 0, SAP: 0 };
  for (const c of crm) {
    const f = c.properties?.["Formation d'intérêt"]?.select?.name;
    if (f && f in crmParFormation) crmParFormation[f]++;
  }

  const leadsParPipeline = { Lead: 0, Contacté: 0, 'Client Standard': 0, 'Client Premium': 0 };
  for (const l of crm) {
    const p = l.properties?.Pipeline?.select?.name;
    if (p && p in leadsParPipeline) leadsParPipeline[p]++;
  }

  let totalRevenu = 0;
  for (const t of transactions) {
    const statut = t.properties?.Statut?.select?.name || '';
    if (statut !== 'Validé') continue;
    totalRevenu += t.properties?.Montant?.number || 0;
  }

  const dernieresInscriptions = comptes.slice(0, 5).map((c) => ({
    prenom: c.properties?.Prenom?.rich_text?.[0]?.text?.content || '',
    nom: c.properties?.Nom?.rich_text?.[0]?.text?.content || '',
    email: c.properties?.Email?.title?.[0]?.text?.content || '',
    date: c.created_time || '',
  }));

  const dernieresTransactions = transactions.slice(0, 5).map((t) => ({
    reference: t.properties?.Référence?.title?.[0]?.text?.content || '',
    email: t.properties?.['Email client']?.email || '',
    formation: t.properties?.Formation?.select?.name || '',
    montant: t.properties?.Montant?.number || 0,
    statut: t.properties?.Statut?.select?.name || '',
    date: t.properties?.Date?.date?.start || t.created_time || '',
  }));

  const tousLesComptes = comptes.map((c) => ({
    email: c.properties?.Email?.title?.[0]?.text?.content || '',
    prenom: c.properties?.Prenom?.rich_text?.[0]?.text?.content || '',
    nom: c.properties?.Nom?.rich_text?.[0]?.text?.content || '',
    statut: c.properties?.Statut?.select?.name || 'Standard',
    date: c.created_time || '',
  }));

  envoyerJson(res, {
    succes: true,
    stats: {
      totalComptes: comptes.length,
      totalLeads: crm.length,
      totalTransactions: transactions.length,
      totalRevenu,
      comptesParStatut,
      crmParFormation,
      leadsParPipeline,
      dernieresInscriptions,
      dernieresTransactions,
      tousLesComptes,
    },
  });
}

/* --- Dispatch --- */
function chemin(req) {
  return (req.url || '').split('?')[0];
}

module.exports = async (req, res) => {
  const p = chemin(req);
  if (p.endsWith('/changer-statut')) return changerStatut(req, res);
  if (p.endsWith('/supprimer-compte')) return supprimerCompte(req, res);
  if (p.endsWith('/stats')) return stats(req, res);
  return envoyerJson(res, { succes: false, message: 'Route inconnue' }, 404);
};

/* Exporte aussi les 3 handlers individuellement, pour pouvoir les tester
   unitairement sans dependre du dispatch sur req.url. */
module.exports.changerStatut = changerStatut;
module.exports.supprimerCompte = supprimerCompte;
module.exports.stats = stats;
