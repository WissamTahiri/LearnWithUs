/* =============================================================
   api/_lib/hmac.js — Primitive de signature generique
   =============================================================
   Equivalent Node de backend-php/helpers/token.php, generalise :
   le payload est un objet JSON (pas le format "a|b|c|d" a 4
   champs pipe-delimites) pour pouvoir porter prenom/nom/statut
   dans le cookie de session en plus des tokens de reset.
   Format : <payload_base64url>.<signature_hmac_hex>
   ============================================================= */

const crypto = require('crypto');

function base64UrlEncode(str) {
  return Buffer.from(str, 'utf8')
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function base64UrlDecode(str) {
  const pad = str.length % 4 === 0 ? '' : '='.repeat(4 - (str.length % 4));
  const base64 = str.replace(/-/g, '+').replace(/_/g, '/') + pad;
  return Buffer.from(base64, 'base64').toString('utf8');
}

function sign(payloadObj, secret) {
  const payload = base64UrlEncode(JSON.stringify(payloadObj));
  const sig = crypto.createHmac('sha256', secret).update(payload).digest('hex');
  return payload + '.' + sig;
}

/* Verifie la signature et l'expiration (payloadObj.exp en secondes epoch).
   Retourne l'objet decode si valide, sinon null. */
function verify(token, secret) {
  if (!token || typeof token !== 'string' || token.indexOf('.') === -1) return null;

  const idx = token.indexOf('.');
  const payload = token.slice(0, idx);
  const sig = token.slice(idx + 1);
  if (!payload || !sig) return null;

  const sigAttendue = crypto.createHmac('sha256', secret).update(payload).digest('hex');
  const bufA = Buffer.from(sig, 'hex');
  const bufB = Buffer.from(sigAttendue, 'hex');
  if (bufA.length !== bufB.length || !crypto.timingSafeEqual(bufA, bufB)) return null;

  let obj;
  try {
    obj = JSON.parse(base64UrlDecode(payload));
  } catch (e) {
    return null;
  }

  if (obj.exp && Math.floor(Date.now() / 1000) > obj.exp) return null;
  return obj;
}

module.exports = { sign, verify, base64UrlEncode, base64UrlDecode };
