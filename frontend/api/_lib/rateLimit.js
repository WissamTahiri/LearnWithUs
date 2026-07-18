/* =============================================================
   api/_lib/rateLimit.js — Anti-bruteforce + verrou anti-doublon
   =============================================================
   Remplace backend-php/helpers/rate-limit.php (fichiers JSON) et
   le flock() de creer-compte.php : le disque Vercel est ephemere,
   aucun fichier ne survit entre deux invocations. Upstash Redis
   (palier gratuit) sert de stockage partage entre les instances.
   ============================================================= */

const crypto = require('crypto');
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
   remplacement simple si besoin plus tard.
   Appels Redis proteges : une panne/mauvaise config Upstash degrade
   le rate-limit (fail-open) plutot que de faire planter les routes
   d'ecriture qui en dependent (le PHP original, fichier local, ne
   pouvait jamais tomber en panne de cette facon). */
async function verifierRateLimit(cle, maxTentatives = 10, fenetreSec = 900, ip) {
  if (estIpLocale(ip)) return true;

  const cleRedis = 'rl:' + cle.replace(/[^a-zA-Z0-9_.-]/g, '_');
  try {
    const compte = await redis.incr(cleRedis);
    if (compte === 1) await redis.expire(cleRedis, fenetreSec);
    return compte <= maxTentatives;
  } catch (e) {
    console.error('[RateLimit] verifierRateLimit erreur Redis (fail-open) : ' + e.message);
    return true;
  }
}

/* Script Lua : ne supprime la cle QUE si sa valeur correspond encore au
   jeton fourni (verification de propriete atomique cote Redis). Sans ca,
   un DEL inconditionnel pourrait supprimer le verrou d'une AUTRE requete
   qui l'aurait acquis entre-temps (ex: le TTL de la requete A a expire
   sous forte latence Notion, B a acquis le meme verrou, puis le finally
   tardif de A supprimait le verrou de B). */
const SCRIPT_LIBERER_SI_PROPRIETAIRE = `
if redis.call("GET", KEYS[1]) == ARGV[1] then
  return redis.call("DEL", KEYS[1])
else
  return 0
end`;

/* Verrou anti-doublon generique. flock() PHP est bloquant ; l'API REST
   Upstash ne l'est pas — on simule avec un court retry-poll borne
   (~1,5s de budget). TTL 5s = filet de securite anti-deadlock (remplace
   la liberation automatique de flock() a la fermeture du process PHP).
   Retourne une chaine opaque "cle::jeton" (le jeton prouve la propriete
   du verrou a la liberation) ou null si non acquis. */
async function acquerirVerrou(prefixe, cle) {
  const cleRedis = prefixe + cle;
  const jeton = crypto.randomUUID();
  for (let tentative = 0; tentative < 10; tentative++) {
    try {
      const acquis = await redis.set(cleRedis, jeton, { nx: true, ex: 5 });
      if (acquis) return cleRedis + '::' + jeton;
    } catch (e) {
      /* Erreur reseau/config Redis : fail-closed, pas de retry — une
         indisponibilite Redis ne doit pas etre interpretee comme un feu
         vert pour agir sans protection anti-doublon. */
      console.error('[RateLimit] acquerirVerrou erreur Redis (fail-closed) sur ' + cleRedis + ' : ' + e.message);
      return null;
    }
    await new Promise((r) => setTimeout(r, 150));
  }
  return null;
}

/* Verrou anti-doublon (creation de compte). */
async function acquerirVerrouCreation(email) {
  return acquerirVerrou('lock:creation:', email);
}

/* Verrou anti-doublon (activation Premium) — meme strategie, prefixe de
   cle distinct pour ne pas collisionner avec le verrou de creation. */
async function acquerirVerrouPremium(email) {
  return acquerirVerrou('lock:premium:', email);
}

/* Libere un verrou obtenu via acquerirVerrou*(). Parse la chaine opaque
   "cle::jeton" (dernier "::" — robuste meme si l'email en contenait,
   puisque le jeton crypto.randomUUID() n'en contient jamais) et ne
   supprime la cle Redis que si elle appartient encore a cette requete. */
async function libererVerrou(verrou) {
  if (!verrou) return;
  const idx = verrou.lastIndexOf('::');
  if (idx === -1) return; /* format inattendu : no-op, comme avant pour une valeur falsy */
  const cle = verrou.slice(0, idx);
  const jeton = verrou.slice(idx + 2);
  try {
    await redis.eval(SCRIPT_LIBERER_SI_PROPRIETAIRE, [cle], [jeton]);
  } catch (e) {
    /* Le TTL de 5s reste le filet de securite deja documente. */
    console.error('[RateLimit] libererVerrou erreur Redis sur ' + cle + ' : ' + e.message);
  }
}

module.exports = {
  verifierRateLimit,
  acquerirVerrouCreation,
  acquerirVerrouPremium,
  libererVerrou,
  obtenirIp,
  estIpLocale,
};
