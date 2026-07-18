/* =============================================================
   api/deconnexion.js — Déconnexion
   =============================================================
   Aucune méthode imposée (comme le PHP original), aucune auth
   requise (safe no-op si déjà déconnecté).
   ============================================================= */

const { envoyerJson } = require('./_lib/http');
const { effacerCookieSession } = require('./_lib/cookie');

module.exports = (req, res) => {
  effacerCookieSession(res);
  envoyerJson(res, { succes: true, message: 'Vous êtes déconnecté' });
};
