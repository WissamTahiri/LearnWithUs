/* =============================================================
   api/_lib/cookie.js — Session via cookie HTTP-only signe
   =============================================================
   Remplace $_SESSION (backend-php/helpers/auth.php). Pas d'etat
   cote serveur : le cookie contient directement email/prenom/nom/
   statut, signe HMAC (api/_lib/hmac.js) pour empecher toute
   falsification. estAdmin N'EST PAS stocke dans le cookie — il
   est recalcule a chaque requete contre ADMIN_EMAILS (retirer un
   admin de la liste prend effet immediatement, pas besoin
   d'attendre l'expiration d'un cookie deja emis).
   ============================================================= */

const cookieLib = require('cookie');
const { sign, verify } = require('./hmac');

const NOM_COOKIE = 'lwu_session';
const DUREE_SEC = 7 * 24 * 60 * 60; /* 7 jours, identique au PHP */

function ecrireCookieSession(res, utilisateur) {
  const payload = {
    email: utilisateur.email,
    prenom: utilisateur.prenom,
    nom: utilisateur.nom,
    statut: utilisateur.statut,
    exp: Math.floor(Date.now() / 1000) + DUREE_SEC,
  };
  const token = sign(payload, process.env.APP_SECRET);

  const enTete = cookieLib.serialize(NOM_COOKIE, token, {
    httpOnly: true,
    path: '/',
    sameSite: 'lax',
    secure: process.env.VERCEL_ENV !== 'development',
    maxAge: DUREE_SEC,
  });

  const existant = res.getHeader('Set-Cookie');
  if (existant) {
    res.setHeader('Set-Cookie', Array.isArray(existant) ? [...existant, enTete] : [existant, enTete]);
  } else {
    res.setHeader('Set-Cookie', enTete);
  }
}

function lireCookieSession(req) {
  const entetes = req.headers.cookie;
  if (!entetes) return null;

  const cookies = cookieLib.parse(entetes);
  const token = cookies[NOM_COOKIE];
  if (!token) return null;

  return verify(token, process.env.APP_SECRET);
}

function effacerCookieSession(res) {
  const enTete = cookieLib.serialize(NOM_COOKIE, '', {
    httpOnly: true,
    path: '/',
    sameSite: 'lax',
    secure: process.env.VERCEL_ENV !== 'development',
    maxAge: 0,
  });
  res.setHeader('Set-Cookie', enTete);
}

module.exports = { ecrireCookieSession, lireCookieSession, effacerCookieSession };
