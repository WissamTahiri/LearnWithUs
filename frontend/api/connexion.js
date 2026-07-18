/* =============================================================
   api/connexion.js — Connexion utilisateur
   =============================================================
   1. Cherche le compte par email (Notion)
   2. Vérifie le mot de passe (bcrypt contre le hash stocké)
   3. Ouvre la session (cookie signé)
   ============================================================= */

const { lireCorps, envoyerJson, exigerMethode } = require('./_lib/http');
const { chercherCompteParEmail, lireCompte } = require('./_lib/comptes');
const { estAdmin } = require('./_lib/auth');
const { verifierRateLimit, obtenirIp } = require('./_lib/rateLimit');
const { comparerMdp, HASH_FACTICE } = require('./_lib/bcryptCompat');
const { ecrireCookieSession } = require('./_lib/cookie');

module.exports = async (req, res) => {
  if (!exigerMethode(req, res, 'POST')) return;

  const d = lireCorps(req);
  const email = (d.email || '').trim().toLowerCase();
  const mdp = d.motDePasse || '';

  /* Anti-bruteforce à DEUX niveaux (les deux checks s'exécutent
     toujours, pour qu'ils enregistrent chacun leur tentative) :
     - par IP + email (10/15min) : protège un compte ciblé sans
       bloquer les autres utilisateurs derrière une IP partagée ;
     - par IP seule (40/15min) : plafond global anti credential
       stuffing. */
  const ip = obtenirIp(req);
  const ipOk = await verifierRateLimit('connexion-ip-' + ip, 40, 900, ip);
  const emailOk = await verifierRateLimit('connexion-' + ip + '-' + email, 10, 900, ip);
  if (!ipOk || !emailOk) {
    return envoyerJson(res, { succes: false, message: 'Trop de tentatives, réessayez dans 15 minutes.' }, 429);
  }

  if (!email || !mdp) {
    return envoyerJson(res, { succes: false, message: 'Email et mot de passe obligatoires' }, 400);
  }

  const page = await chercherCompteParEmail(email);
  if (!page) {
    /* Anti-énumération par timing : on exécute quand même une
       comparaison bcrypt contre un hash factice (même coût 10) pour
       que la réponse mette le même temps qu'un compte existant. */
    await comparerMdp(mdp, HASH_FACTICE);
    return envoyerJson(res, { succes: false, message: 'Email ou mot de passe incorrect' }, 401);
  }

  const compte = lireCompte(page);

  if (!(await comparerMdp(mdp, compte.hash))) {
    return envoyerJson(res, { succes: false, message: 'Email ou mot de passe incorrect' }, 401);
  }

  const utilisateur = { email: compte.email, prenom: compte.prenom, nom: compte.nom, statut: compte.statut };
  ecrireCookieSession(res, utilisateur);

  envoyerJson(res, {
    succes: true,
    message: 'Connexion réussie',
    utilisateur: { ...utilisateur, estAdmin: estAdmin(email) },
  });
};
