/* =============================================================
   api/_lib/cookie.js — Session via cookie HTTP-only signe
   =============================================================
   Remplace $_SESSION (backend-php/helpers/auth.php). Le cookie
   contient email/prenom/nom/statut, signe HMAC (api/_lib/hmac.js)
   pour empecher toute falsification. estAdmin N'EST PAS stocke
   dans le cookie — il est recalcule a chaque requete contre
   ADMIN_EMAILS.

   Revocation cote serveur : le cookie porte aussi un numero de
   version ("ver"), compare a un compteur Redis (Upstash, meme
   pattern que rateLimit.js) a chaque lecture. Sans ca, un cookie
   signe reste valide jusqu'a expiration (7 jours) meme apres une
   deconnexion explicite, un changement de mot de passe, ou une
   retrogradation admin — equivalent du vrai session_destroy() PHP.
   ============================================================= */

const cookieLib = require('cookie');
const { Redis } = require('@upstash/redis');
const { sign, verify } = require('./hmac');

const redis = Redis.fromEnv();

const NOM_COOKIE = 'lwu_session';
const DUREE_SEC = 7 * 24 * 60 * 60; /* 7 jours, identique au PHP */
const PREFIXE_VERSION = 'sessver:';

/* Lit la version de session courante pour un email (0 par defaut, aucune
   ecriture Redis tant qu'aucune revocation n'a jamais eu lieu pour ce
   compte). Fail-open (retourne 0 = "aucune revocation connue") en cas de
   panne Redis : mieux vaut laisser une session legitime passer que de
   casser TOUTE l'authentification du site pour un incident Upstash. */
async function versionSessionActuelle(email) {
  try {
    const v = await redis.get(PREFIXE_VERSION + email.toLowerCase());
    return Number(v) || 0;
  } catch (e) {
    console.error('[Cookie] versionSessionActuelle erreur Redis (fail-open) : ' + e.message);
    return 0;
  }
}

/* Revoque toutes les sessions existantes d'un email (tout cookie deja
   emis, meme non expire, devient invalide au prochain appel de
   lireCookieSession). A appeler explicitement : deconnexion, changement
   de mot de passe, retrogradation de statut par un admin. Le TTL est
   rafraichi a DUREE_SEC a chaque appel pour rester synchronise avec la
   duree de vie max d'un cookie deja emis (jamais de "reset a 0" qui
   revaliderait un vieux cookie deja revoque). */
async function invaliderSessionsUtilisateur(email) {
  if (!email) return;
  try {
    const cle = PREFIXE_VERSION + email.toLowerCase();
    await redis.incr(cle);
    await redis.expire(cle, DUREE_SEC);
  } catch (e) {
    console.error('[Cookie] invaliderSessionsUtilisateur erreur Redis : ' + e.message);
  }
}

async function ecrireCookieSession(res, utilisateur) {
  const payload = {
    email: utilisateur.email,
    prenom: utilisateur.prenom,
    nom: utilisateur.nom,
    statut: utilisateur.statut,
    ver: await versionSessionActuelle(utilisateur.email),
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

async function lireCookieSession(req) {
  const entetes = req.headers.cookie;
  if (!entetes) return null;

  const cookies = cookieLib.parse(entetes);
  const token = cookies[NOM_COOKIE];
  if (!token) return null;

  const payload = verify(token, process.env.APP_SECRET);
  if (!payload) return null;

  /* Rejette un cookie cryptographiquement valide mais dont la version
     ne correspond plus a la version serveur courante (revoque depuis). */
  const versionActuelle = await versionSessionActuelle(payload.email);
  if ((payload.ver || 0) !== versionActuelle) return null;

  return payload;
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

module.exports = { ecrireCookieSession, lireCookieSession, effacerCookieSession, invaliderSessionsUtilisateur };
