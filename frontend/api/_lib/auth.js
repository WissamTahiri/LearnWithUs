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

/* Retourne l'utilisateur connecte (objet, avec estAdmin recalcule) ou null. */
function utilisateurConnecte(req) {
  const payload = lireCookieSession(req);
  if (!payload) return null;
  return { ...payload, estAdmin: estAdmin(payload.email) };
}

/* Renvoie l'utilisateur connecte, ou repond 401 et retourne null. */
function exigerConnexion(req, res) {
  const u = utilisateurConnecte(req);
  if (!u) {
    envoyerJson(res, { succes: false, message: 'Authentification requise' }, 401);
    return null;
  }
  return u;
}

/* Renvoie l'utilisateur si admin, sinon repond 403 (ou 401 via
   exigerConnexion) et retourne null. */
function exigerAdmin(req, res) {
  const u = exigerConnexion(req, res);
  if (!u) return null; /* deja repondu par exigerConnexion */
  if (!u.estAdmin) {
    envoyerJson(res, { succes: false, message: "Acces reserve a l'equipe administration" }, 403);
    return null;
  }
  return u;
}

module.exports = { estAdmin, utilisateurConnecte, exigerConnexion, exigerAdmin };
