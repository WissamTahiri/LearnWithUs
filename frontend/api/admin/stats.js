/* =============================================================
   api/admin/stats.js — Dashboard admin (KPI agrégés)
   =============================================================
   Agrège les chiffres clés des bases Notion (Comptes, CRM,
   Transactions — pas la base legacy Inscriptions, jamais
   interrogée par cette route côté PHP non plus malgré le
   commentaire d'en-tête original).
   Réservé aux emails listés dans ADMIN_EMAILS.

   Contrat de sortie STRICT (lu par frontend/js/main.js,
   chargerDashboardAdmin()) : ne pas renommer une seule clé.
   ============================================================= */

const { envoyerJson, exigerMethode } = require('../_lib/http');
const { exigerAdmin } = require('../_lib/auth');
const { listerPagesNotion } = require('../_lib/notion');

function triRecent(a, b) {
  const ta = a.created_time || '';
  const tb = b.created_time || '';
  return tb > ta ? 1 : tb < ta ? -1 : 0;
}

module.exports = async (req, res) => {
  if (!exigerMethode(req, res, 'GET')) return;
  if (!(await exigerAdmin(req, res))) return;

  /* Les 3 bases n'ont aucune dépendance entre elles : on les charge
     en parallèle (pur gain de perf, aucun changement de contrat de
     sortie par rapport au PHP synchrone). */
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

  /* === Comptes : répartition Standard / Premium === */
  const comptesParStatut = { Standard: 0, Premium: 0 };
  for (const c of comptes) {
    const statut = c.properties?.Statut?.select?.name || 'Standard';
    if (statut === 'Premium') comptesParStatut.Premium++;
    else comptesParStatut.Standard++;
  }

  /* === CRM : répartition par formation d'intérêt === */
  const crmParFormation = { IA: 0, SCRUM: 0, SAP: 0 };
  for (const c of crm) {
    const f = c.properties?.["Formation d'intérêt"]?.select?.name;
    if (f && f in crmParFormation) crmParFormation[f]++;
  }

  /* === CRM : répartition par étape de pipeline === */
  const leadsParPipeline = { Lead: 0, Contacté: 0, 'Client Standard': 0, 'Client Premium': 0 };
  for (const l of crm) {
    const p = l.properties?.Pipeline?.select?.name;
    if (p && p in leadsParPipeline) leadsParPipeline[p]++;
  }

  /* === Transactions : revenu total (somme des "Validé") === */
  let totalRevenu = 0;
  for (const t of transactions) {
    const statut = t.properties?.Statut?.select?.name || '';
    if (statut !== 'Validé') continue;
    totalRevenu += t.properties?.Montant?.number || 0;
  }

  /* === 5 dernières inscriptions === */
  const dernieresInscriptions = comptes.slice(0, 5).map((c) => ({
    prenom: c.properties?.Prenom?.rich_text?.[0]?.text?.content || '',
    nom: c.properties?.Nom?.rich_text?.[0]?.text?.content || '',
    email: c.properties?.Email?.title?.[0]?.text?.content || '',
    date: c.created_time || '',
  }));

  /* === 5 dernières transactions === */
  const dernieresTransactions = transactions.slice(0, 5).map((t) => ({
    reference: t.properties?.Référence?.title?.[0]?.text?.content || '',
    email: t.properties?.['Email client']?.email || '',
    formation: t.properties?.Formation?.select?.name || '',
    montant: t.properties?.Montant?.number || 0,
    statut: t.properties?.Statut?.select?.name || '',
    date: t.properties?.Date?.date?.start || t.created_time || '',
  }));

  /* === Tous les comptes (gestion admin : delete + statut) === */
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
};
