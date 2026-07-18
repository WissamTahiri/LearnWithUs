/* =============================================================
   api/_lib/http.js — Bootstrap commun a toutes les routes API
   =============================================================
   Equivalent Node de backend-php/api/_init.php.
   Vercel fournit deja req.body parse (JSON ou form-urlencoded)
   selon le Content-Type, donc lireCorps() se contente de
   normaliser (jamais null/undefined).
   ============================================================= */

function lireCorps(req) {
  return req.body && typeof req.body === 'object' ? req.body : {};
}

/* Regex email pratique et largement utilisee (equivalent JS le
   plus proche de FILTER_VALIDATE_EMAIL en PHP — JS n'a pas
   d'equivalent natif). Centralisee ici pour que toutes les
   routes valident un email exactement de la meme facon. */
const REGEX_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
function emailValide(email) {
  return typeof email === 'string' && REGEX_EMAIL.test(email);
}

function envoyerJson(res, payload, code = 200) {
  res.status(code).json(payload);
}

/* Retourne true si la methode correspond, sinon repond 405 et
   retourne false — l'appelant doit alors faire `return`. */
function exigerMethode(req, res, attendu) {
  if (req.method !== attendu) {
    envoyerJson(res, { succes: false, message: 'Methode non autorisee' }, 405);
    return false;
  }
  return true;
}

module.exports = { lireCorps, envoyerJson, exigerMethode, emailValide };
