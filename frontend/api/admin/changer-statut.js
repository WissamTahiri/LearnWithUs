/* =============================================================
   api/admin/changer-statut.js — Admin bascule Standard ↔ Premium
   =============================================================
   Geste commercial / résiliation anticipée — sans déclencher
   de webhook (silent update).
   ============================================================= */

const { lireCorps, envoyerJson, exigerMethode, texte } = require('../_lib/http');
const { exigerAdmin } = require('../_lib/auth');
const { chercherCompteParEmail, lireCompte } = require('../_lib/comptes');
const { appelerNotion } = require('../_lib/notion');
const { synchroniserCRM } = require('../_lib/crm');
const { invaliderSessionsUtilisateur } = require('../_lib/cookie');

module.exports = async (req, res) => {
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

  /* === Aligne le CRM sur le nouveau statut ===
     Sans cette synchro, un compte passe Premium par l'admin restait "Lead"
     dans le CRM : le pipeline n'était mis à jour que par le paiement en
     self-service. Premium -> Client Premium ; retour Standard -> Client. */
  const compte = lireCompte(page);
  await synchroniserCRM({
    email: emailCible,
    nomComplet: (compte.prenom + ' ' + compte.nom).trim() || emailCible,
    pipeline: nouveauStatut === 'Premium' ? 'Client Premium' : 'Client',
  });

  /* Un utilisateur rétrogradé (Premium -> Standard) ne doit pas garder son
     cookie 'statut=Premium' jusqu'à expiration naturelle — force une
     reconnexion qui émettra un cookie à jour. */
  await invaliderSessionsUtilisateur(emailCible);

  envoyerJson(res, { succes: true, message: 'Statut mis à jour : ' + nouveauStatut });
};
