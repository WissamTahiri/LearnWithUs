/* =============================================================
   api/_lib/rateLimit.js — Anti-bruteforce + verrou anti-doublon
   =============================================================
   Remplace backend-php/helpers/rate-limit.php (fichiers JSON) et
   le flock() de creer-compte.php : le disque Vercel est ephemere,
   aucun fichier ne survit entre deux invocations. Upstash Redis
   (palier gratuit) sert de stockage partage entre les instances.
   ============================================================= */

const { Redis } = require('@upstash/redis');

const redis = Redis.fromEnv();

/* Memes IP exemptees que le PHP (utile en dev/demo). */
function estIpLocale(ip) {
  return ['127.0.0.1', '::1', 'inconnu'].includes(ip);
}

/* Sur Vercel, contrairement a Apache/PHP, il n'y a pas de
   REMOTE_ADDR fiable : la requete passe toujours par le edge
   proxy Vercel, qui pose x-forwarded-for de facon fiable. */
function obtenirIp(req) {
  const entete = req.headers['x-forwarded-for'];
  if (!entete) return 'inconnu';
  return entete.split(',')[0].trim();
}

/* Fenetre FIXE (INCR + EXPIRE), differente de la fenetre glissante
   du PHP original (purge des timestamps expires a chaque appel) —
   compromis assume : une petite rafale a la frontiere de fenetre
   reste possible. @upstash/ratelimit (sliding window) reste un
   remplacement simple si besoin plus tard. */
async function verifierRateLimit(cle, maxTentatives = 10, fenetreSec = 900, ip) {
  if (estIpLocale(ip)) return true;

  const cleRedis = 'rl:' + cle.replace(/[^a-zA-Z0-9_.-]/g, '_');
  const compte = await redis.incr(cleRedis);
  if (compte === 1) await redis.expire(cleRedis, fenetreSec);
  return compte <= maxTentatives;
}

/* Verrou anti-doublon (creation de compte). flock() PHP est
   bloquant ; l'API REST Upstash ne l'est pas — on simule avec un
   court retry-poll borne (~1,5s de budget). TTL 5s = filet de
   securite anti-deadlock (remplace la liberation automatique de
   flock() a la fermeture du process PHP). */
async function acquerirVerrouCreation(email) {
  const cle = 'lock:creation:' + email;
  for (let tentative = 0; tentative < 10; tentative++) {
    const acquis = await redis.set(cle, '1', { nx: true, ex: 5 });
    if (acquis) return cle;
    await new Promise((r) => setTimeout(r, 150));
  }
  return null;
}

async function libererVerrou(cle) {
  await redis.del(cle);
}

module.exports = { verifierRateLimit, acquerirVerrouCreation, libererVerrou, obtenirIp, estIpLocale };
