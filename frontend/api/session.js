/* =============================================================
   api/session.js — Utilisateur de la session courante
   =============================================================
   Confirmé NON appelé par le frontend actuel (voir main.js) —
   porté quand même pour la parité d'API avec le backend PHP.
   Aucune méthode imposée.
   ============================================================= */

const { envoyerJson } = require('./_lib/http');
const { utilisateurConnecte } = require('./_lib/auth');

module.exports = (req, res) => {
  envoyerJson(res, { succes: true, utilisateur: utilisateurConnecte(req) });
};
