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

/* Coerce une valeur du corps JSON en string avant trim(). Un body JSON
   peut contenir n'importe quel type sur un champ (nombre, bool, objet,
   tableau) — sans cette garde, `(valeur || '').trim()` plante avec un
   TypeError si valeur est truthy mais pas une string. Un champ non-string
   est traite comme absent ('' -> echoue ensuite la validation "obligatoire"
   normalement, au lieu de faire planter la fonction serverless). */
function texte(valeur) {
  return typeof valeur === 'string' ? valeur.trim() : '';
}

/* Regex email pratique et largement utilisee (approximation RFC 5322
   simplifiee du comportement de FILTER_VALIDATE_EMAIL en PHP — JS n'a
   pas d'equivalent natif, et ce n'est pas une equivalence garantie a
   100% au-dela des cas testes). Rejette explicitement les doubles points
   (partie locale et domaine) et les labels de domaine commencant/finissant
   par un tiret, que PHP rejette aussi. Centralisee ici pour que toutes
   les routes valident un email exactement de la meme facon. */
const REGEX_EMAIL =
  /^[A-Za-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[A-Za-z0-9!#$%&'*+/=?^_`{|}~-]+)*@[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?)+$/;
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
    envoyerJson(res, { succes: false, message: 'Méthode non autorisée' }, 405);
    return false;
  }
  return true;
}

module.exports = { lireCorps, envoyerJson, exigerMethode, emailValide, texte };
