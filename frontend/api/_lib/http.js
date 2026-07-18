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

module.exports = { lireCorps, envoyerJson, exigerMethode };
