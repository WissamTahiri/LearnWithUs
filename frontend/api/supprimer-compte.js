/* =============================================================
   api/supprimer-compte.js — Suppression du compte (utilisateur)
   =============================================================
   Permet à un utilisateur connecté de supprimer son propre
   compte (droit à l'effacement RGPD).
   - On ARCHIVE la page Notion (soft delete) pour garder une
     trace technique
   - On NE supprime PAS l'entrée CRM : on conserve l'historique
     du lead pour la comptabilité
   - On efface le cookie de session (déconnexion automatique)
   ============================================================= */

const { envoyerJson, exigerMethode } = require('./_lib/http');
const { exigerConnexion } = require('./_lib/auth');
const { chercherCompteParEmail } = require('./_lib/comptes');
const { appelerNotion } = require('./_lib/notion');
const { effacerCookieSession } = require('./_lib/cookie');

module.exports = async (req, res) => {
  if (!exigerMethode(req, res, 'POST')) return; /* POST plutôt que DELETE : formulaires HTML classiques */

  const utilisateur = await exigerConnexion(req, res);
  if (!utilisateur) return;
  const email = utilisateur.email;

  const page = await chercherCompteParEmail(email);
  if (!page) {
    return envoyerJson(res, { succes: false, message: 'Compte introuvable' }, 404);
  }

  const archive = await appelerNotion('PATCH', 'pages/' + page.id, { archived: true });
  if (!archive) {
    return envoyerJson(res, { succes: false, message: 'Erreur lors de la suppression du compte' }, 500);
  }

  effacerCookieSession(res);
  envoyerJson(res, { succes: true, message: 'Votre compte a bien été supprimé' });
};
