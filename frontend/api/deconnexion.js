/* =============================================================
   api/deconnexion.js — Déconnexion
   =============================================================
   Aucune méthode imposée (comme le PHP original), aucune auth
   requise (safe no-op si déjà déconnecté).
   ============================================================= */

const { envoyerJson } = require('./_lib/http');
const { utilisateurConnecte } = require('./_lib/auth');
const { effacerCookieSession, invaliderSessionsUtilisateur } = require('./_lib/cookie');

module.exports = async (req, res) => {
  /* Révoque la session côté serveur (pas seulement le cookie local) :
     un cookie déjà copié avant ce clic (log de proxy, poste partagé,
     vol d'appareil) devient inutilisable immédiatement, plutôt que de
     rester valide jusqu'à expiration naturelle (7 jours). */
  const u = await utilisateurConnecte(req);
  if (u) await invaliderSessionsUtilisateur(u.email);

  effacerCookieSession(res);
  envoyerJson(res, { succes: true, message: 'Vous êtes déconnecté' });
};
