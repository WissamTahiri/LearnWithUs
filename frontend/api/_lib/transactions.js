/* =============================================================
   api/_lib/transactions.js — Enregistrement des paiements
   =============================================================
   Equivalent Node de backend-php/helpers/transactions.php.
   Aucune donnee bancaire stockee (RGPD / PCI DSS) — uniquement
   les metadonnees (email, montant, date, reference).
   ============================================================= */

const { appelerNotion } = require('./notion');

/* Reference au format TXN-YYYYMMDD-HHMMSS. Limite connue (heritee
   du PHP, non corrigee) : pas de garantie d'unicite au-dela de la
   seconde — deux transactions dans la meme seconde collisionneraient. */
function genererReferenceTransaction() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  const date = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;
  const heure = `${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
  return `TXN-${date}-${heure}`;
}

/* donnees attend les cles : email, formation (opt), montant (opt),
   statut (opt). Retourne la reference generee, ou null en cas
   d'erreur. */
async function enregistrerTransaction(donnees) {
  if (!process.env.NOTION_DS_TRANSACTIONS_ID) {
    console.error('[Transactions] NOTION_DS_TRANSACTIONS_ID non configure');
    return null;
  }

  const reference = genererReferenceTransaction();
  const aujourdhui = new Date().toISOString().slice(0, 10);

  const reponse = await appelerNotion('POST', 'pages', {
    parent: { data_source_id: process.env.NOTION_DS_TRANSACTIONS_ID },
    properties: {
      Référence: { title: [{ text: { content: reference } }] },
      'Email client': { email: donnees.email },
      Formation: { select: { name: donnees.formation || 'Premium global' } },
      Montant: { number: donnees.montant || 29 },
      Date: { date: { start: aujourdhui } },
      Statut: { select: { name: donnees.statut || 'Validé' } },
    },
  });

  return reponse ? reference : null;
}

module.exports = { genererReferenceTransaction, enregistrerTransaction };
