/* =============================================================
   api/_lib/auth.js — Autorisations
   =============================================================
   Equivalent Node de backend-php/helpers/auth.php. Pas d'exit()
   en Node : chaque fonction repond directement (401/403) et
   retourne null si le controle echoue — l'appelant doit alors
   faire `return`. Sinon retourne l'utilisateur.
   ============================================================= */

const { lireCookieSession } = require('./cookie');
const { envoyerJson } = require('./http');

/* Verifie si un email est dans la liste ADMIN_EMAILS (case-insensitive). */
function estAdmin(email) {
  if (!email) return false;
  const liste = (process.env.ADMIN_EMAILS || '')
    .split(',')
    .map((e) => e.trim().toLowerCase());
  return liste.includes(email.toLowerCase());
}

/* Retourne l'utilisateur connecte (objet, avec estAdmin recalcule) ou null.
   Async depuis l'ajout de la revocation server-side (lireCookieSession
   verifie la version en Redis) — TOUS les appelants doivent await, sinon
   ils recoivent une Promise (toujours truthy) au lieu de l'utilisateur/null
   et court-circuitent silencieusement les gardes d'authentification. */
async function utilisateurConnecte(req) {
  const payload = await lireCookieSession(req);
  if (!payload) return null;
  return { ...payload, estAdmin: estAdmin(payload.email) };
}

/* Renvoie l'utilisateur connecte, ou repond 401 et retourne null. */
async function exigerConnexion(req, res) {
  const u = await utilisateurConnecte(req);
  if (!u) {
    envoyerJson(res, { succes: false, message: 'Authentification requise' }, 401);
    return null;
  }
  return u;
}

/* Renvoie l'utilisateur si admin, sinon repond 403 (ou 401 via
   exigerConnexion) et retourne null. */
async function exigerAdmin(req, res) {
  const u = await exigerConnexion(req, res);
  if (!u) return null; /* deja repondu par exigerConnexion */
  if (!u.estAdmin) {
    envoyerJson(res, { succes: false, message: "Accès réservé à l'équipe administration" }, 403);
    return null;
  }
  return u;
}

module.exports = { estAdmin, utilisateurConnecte, exigerConnexion, exigerAdmin };
