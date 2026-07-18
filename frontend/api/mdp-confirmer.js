/* =============================================================
   api/mdp-confirmer.js — Confirmation du nouveau mot de passe
   =============================================================
   1. Vérifie le token reçu par email (signature + expiration + purpose)
   2. Met à jour le hash bcrypt dans Notion
   ============================================================= */

const crypto = require('crypto');
const { lireCorps, envoyerJson, exigerMethode } = require('./_lib/http');
const { chercherCompteParEmail, lireCompte } = require('./_lib/comptes');
const { appelerNotion } = require('./_lib/notion');
const { verifierToken } = require('./_lib/token');
const { verifierRateLimit, obtenirIp } = require('./_lib/rateLimit');
const { hashMdp } = require('./_lib/bcryptCompat');

module.exports = async (req, res) => {
  if (!exigerMethode(req, res, 'POST')) return;

  /* Anti-bruteforce : 5 tentatives / 15 min par IP. Empêche un
     attaquant de forger des tokens et de tester massivement. */
  const ip = obtenirIp(req);
  const ok = await verifierRateLimit('mdp-confirmer-' + ip, 5, 900, ip);
  if (!ok) {
    return envoyerJson(res, { succes: false, message: 'Trop de tentatives, réessayez dans 15 minutes.' }, 429);
  }

  const d = lireCorps(req);
  const token = d.token || '';
  const nouveauMdp = d.nouveauMdp || '';

  if (!token || !nouveauMdp) {
    return envoyerJson(res, { succes: false, message: 'Token et nouveau mot de passe obligatoires' }, 400);
  }

  if (nouveauMdp.length < 8 || !/[A-Z]/.test(nouveauMdp) || !/[0-9]/.test(nouveauMdp)) {
    return envoyerJson(res, {
      succes: false,
      message: 'Le mot de passe doit faire au moins 8 caractères, avec une majuscule et un chiffre',
    }, 400);
  }

  /* Vérifie signature + expiration + purpose='reset' */
  const payload = verifierToken(token, 'reset');
  if (!payload) {
    return envoyerJson(res, { succes: false, message: 'Lien invalide ou expiré (valable 15 minutes)' }, 400);
  }

  const page = await chercherCompteParEmail(payload.email);
  if (!page) {
    return envoyerJson(res, { succes: false, message: 'Compte introuvable' }, 404);
  }

  /* Usage unique : le token porte l'empreinte du hash au moment de l'envoi.
     Si le mot de passe a déjà changé depuis (lien rejoué, ou un 2e lien plus
     récent a été demandé), l'empreinte ne correspond plus → on refuse. */
  const compte = lireCompte(page);
  const empreinteActuelle = crypto.createHash('sha256').update(compte.hash).digest('hex').slice(0, 16);
  const bufA = Buffer.from(empreinteActuelle);
  const bufB = Buffer.from(payload.liaison || '');
  const correspond = bufA.length === bufB.length && crypto.timingSafeEqual(bufA, bufB);
  if (!correspond) {
    return envoyerJson(res, { succes: false, message: 'Lien déjà utilisé ou expiré (valable 15 minutes)' }, 400);
  }

  const nouveauHash = await hashMdp(nouveauMdp);

  const maj = await appelerNotion('PATCH', 'pages/' + page.id, {
    properties: { 'Mot de passe': { rich_text: [{ text: { content: nouveauHash } }] } },
  });

  if (!maj) {
    return envoyerJson(res, { succes: false, message: 'Erreur lors de la mise à jour' }, 500);
  }

  envoyerJson(res, { succes: true, message: 'Mot de passe réinitialisé' });
};
