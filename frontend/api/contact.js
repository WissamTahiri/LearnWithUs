/* =============================================================
   api/contact.js — Formulaire de contact
   =============================================================
   Equivalent Node de backend-php/api/contact.php.
   ============================================================= */

const { lireCorps, envoyerJson, exigerMethode, emailValide } = require('./_lib/http');
const { verifierRateLimit, obtenirIp } = require('./_lib/rateLimit');
const { appelerWebhook } = require('./_lib/webhook');
const { synchroniserCRM } = require('./_lib/crm');

module.exports = async (req, res) => {
  if (!exigerMethode(req, res, 'POST')) return;

  const ip = obtenirIp(req);
  const ok = await verifierRateLimit('contact-' + ip, 5, 900, ip);
  if (!ok) {
    return envoyerJson(res, { succes: false, message: 'Trop de messages envoyés, réessayez dans 15 minutes.' }, 429);
  }

  const d = lireCorps(req);
  const prenom = (d.prenom || '').trim();
  const nom = (d.nom || '').trim();
  const email = (d.email || '').trim();
  const sujet = (d.sujet || '').trim();
  const message = (d.message || '').trim();

  if (!prenom || !email || !message) {
    return envoyerJson(res, { succes: false, message: 'Prénom, email et message sont obligatoires' }, 400);
  }
  if (!emailValide(email)) {
    return envoyerJson(res, { succes: false, message: 'Email invalide' }, 400);
  }

  await appelerWebhook(process.env.WEBHOOK_N8N_CONTACT, { prenom, nom, email, sujet, message });

  await synchroniserCRM({
    nomComplet: (prenom + ' ' + nom).trim(),
    email,
    source: 'Formulaire contact',
    pipeline: 'Lead',
  });

  envoyerJson(res, { succes: true, message: 'Votre message a bien été reçu. Réponse sous 24h.' });
};
