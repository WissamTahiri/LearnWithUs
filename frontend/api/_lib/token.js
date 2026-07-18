/* =============================================================
   api/_lib/token.js — Tokens pour les liens email (reset mdp)
   =============================================================
   Equivalent Node de backend-php/helpers/token.php, batie sur la
   primitive generique api/_lib/hmac.js. Utilise pour le lien de
   reinitialisation de mot de passe (purpose='reset', 15 min).
   ============================================================= */

const { sign, verify } = require('./hmac');

/* Genere un token signe.
   - email     : email du compte concerne
   - purpose   : raison du token ('reset')
   - dureeSec  : duree de validite en secondes
   - liaison   : valeur qui LIE le token a un etat serveur (ex :
                 empreinte du hash actuel du mot de passe) — usage
                 unique : des que cet etat change, le token ne
                 valide plus (voir api/mdp-confirmer.js). */
function genererToken(email, purpose, dureeSec, liaison = '') {
  const exp = Math.floor(Date.now() / 1000) + dureeSec;
  return sign({ email, purpose, exp, liaison }, process.env.APP_SECRET);
}

/* Verifie un token et retourne {email, purpose, exp, liaison} si
   valide, ou null si signature invalide / expire / mauvais purpose. */
function verifierToken(token, purposeAttendu) {
  const payload = verify(token, process.env.APP_SECRET);
  if (!payload) return null;
  if (payload.purpose !== purposeAttendu) return null;
  return payload;
}

module.exports = { genererToken, verifierToken };
