/* =============================================================
   api/mdp-demande.js — Demande de réinitialisation mdp
   =============================================================
   1. Cherche le compte par email (silencieux si absent pour
      éviter l'énumération de comptes)
   2. Génère un token HMAC valable 15 minutes (purpose='reset')
   3. Construit un lien et l'envoie via le webhook n8n #5
   4. Réponse toujours générique (ne révèle pas si l'email existe)
   ============================================================= */

const crypto = require('crypto');
const { lireCorps, envoyerJson, exigerMethode } = require('./_lib/http');
const { chercherCompteParEmail, lireCompte } = require('./_lib/comptes');
const { verifierRateLimit, obtenirIp } = require('./_lib/rateLimit');
const { genererToken } = require('./_lib/token');
const { appelerWebhook } = require('./_lib/webhook');

/* URL_SITE : en Production, la vraie valeur (https://learnwithus.fr) est
   définie en variable d'environnement. En Preview, on retombe sur
   l'URL auto-injectée par Vercel (VERCEL_URL) si URL_SITE est absente. */
function urlSite() {
  return process.env.URL_SITE || 'https://' + process.env.VERCEL_URL;
}

module.exports = async (req, res) => {
  if (!exigerMethode(req, res, 'POST')) return;

  const d = lireCorps(req);
  const email = (d.email || '').trim().toLowerCase();

  const ip = obtenirIp(req);
  const ok = await verifierRateLimit('mdp-demande-' + ip + '-' + email, 10, 900, ip);
  if (!ok) {
    return envoyerJson(res, { succes: false, message: 'Trop de tentatives, réessayez dans 15 minutes.' }, 429);
  }

  if (!email) {
    return envoyerJson(res, { succes: false, message: 'Email obligatoire' }, 400);
  }

  const page = await chercherCompteParEmail(email);

  if (page) {
    const compte = lireCompte(page);

    /* Empreinte du hash actuel : lie le token au mot de passe courant, ce qui
       rend le lien À USAGE UNIQUE (dès que le mdp change, tout lien émis avant
       devient invalide). */
    const empreinte = crypto.createHash('sha256').update(compte.hash).digest('hex').slice(0, 16);

    const token = genererToken(compte.email, 'reset', 15 * 60, empreinte);
    const lien = urlSite() + '/reset-mot-de-passe.html?token=' + token;

    if (process.env.WEBHOOK_N8N_RESET_MDP) {
      await appelerWebhook(process.env.WEBHOOK_N8N_RESET_MDP, { email: compte.email, prenom: compte.prenom, lien });
    } else {
      /* Pas de webhook configuré : on log le lien côté serveur
         pour permettre les tests dev sans passer par n8n */
      console.error('[Reset] ' + compte.email + ' -> ' + lien);
    }
  }

  /* Réponse volontairement générique (anti-énumération) */
  envoyerJson(res, {
    succes: true,
    message: 'Si un compte existe avec cet email, un lien de réinitialisation vient de partir.',
  });
};
