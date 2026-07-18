/* =============================================================
   api/_lib/bcryptCompat.js — Hash de mots de passe (bcrypt)
   =============================================================
   PHP password_hash() genere des hash prefixes "$2y$". bcryptjs
   ne reconnait pas ce prefixe (il genere lui-meme du "$2a$"),
   alors que l'algorithme est identique — seul le marqueur de
   version differe. On normalise donc en lecture ($2y$ -> $2b$,
   que bcryptjs sait comparer) pour rester compatible avec TOUS
   les comptes deja crees par le backend PHP dans Notion.
   Verifie avec un vrai hash PHP (voir test-ad-hoc.js).

   Piege evite : le hash factice utilise pour la mitigation anti-
   timing-attack (voir api/connexion.js) doit etre genere NATIVEMENT
   par bcryptjs (donc jamais $2y$), jamais reutiliser une constante
   $2y$ — sinon bcryptjs la rejette quasi instantanement (erreur de
   version) au lieu de faire le calcul complet, ce qui annule la
   mitigation et rend a nouveau l'enumeration de comptes possible
   par le temps de reponse.
   ============================================================= */

const bcrypt = require('bcryptjs');

const COUT = 10;

function hashMdp(mdp) {
  return bcrypt.hash(mdp, COUT);
}

function comparerMdp(mdp, hash) {
  const hashNormalise = hash.replace(/^\$2y\$/, '$2b$');
  return bcrypt.compare(mdp, hashNormalise);
}

/* Hash factice genere nativement en $2b$, fige une fois pour toutes
   (calcule au chargement du module, pas a chaque requete). Utilise
   par connexion.js quand le compte n'existe pas, pour que le temps
   de reponse soit indiscernable d'un mauvais mot de passe. */
const HASH_FACTICE = bcrypt.hashSync('mot-de-passe-factice-pour-timing', COUT);

module.exports = { hashMdp, comparerMdp, HASH_FACTICE, COUT };
