/* =============================================================
   api/creer-compte.js — Création d'un compte utilisateur
   =============================================================
   1. Validation des champs (prénom, nom, email, mdp >= 8 car.)
   2. Vérif domaine MX + liste noire jetables + rate-limit
   3. Verrou anti-doublon (Upstash) + refus si l'email existe déjà
   4. Hash bcrypt (bcryptjs)
   5. Création de la page dans la base Notion "Comptes"
   6. Sync CRM Notion (Pipeline=Lead, Source=Création compte)
   7. Webhook n8n bienvenue (email simple, sans lien de vérif)
   8. Connexion automatique (cookie de session)
   ============================================================= */

const dns = require('dns').promises;
const { lireCorps, envoyerJson, exigerMethode, emailValide } = require('./_lib/http');
const { chercherCompteParEmail } = require('./_lib/comptes');
const { estAdmin } = require('./_lib/auth');
const { verifierRateLimit, acquerirVerrouCreation, libererVerrou, obtenirIp } = require('./_lib/rateLimit');
const { appelerWebhook } = require('./_lib/webhook');
const { synchroniserCRM } = require('./_lib/crm');
const { hashMdp } = require('./_lib/bcryptCompat');
const { appelerNotion } = require('./_lib/notion');
const { ecrireCookieSession } = require('./_lib/cookie');

/* Domaines email jetables/temporaires — liste identique au backend
   PHP (backend-php/api/creer-compte.php), à rallonger si besoin. */
const DOMAINES_JETABLES = [
  'yopmail.com', 'yopmail.fr', 'mailinator.com', 'guerrillamail.com',
  'guerrillamail.info', 'sharklasers.com', '10minutemail.com', 'temp-mail.org',
  'tempmail.com', 'tempmailo.com', 'minuteinbox.com', 'throwawaymail.com',
  'getnada.com', 'trashmail.com', 'maildrop.cc', 'mailcatch.com',
  'fakeinbox.com', 'dispostable.com', 'mintemail.com', 'mohmal.com',
  'jetable.org', 'moakt.com', 'mailsac.com', 'discard.email',
  'emailondeck.com', 'spam4.me', 'tempr.email', '33mail.com',
];

/* Equivalent Node de checkdnsrr($domaine, 'MX') : resout les
   enregistrements MX, false si aucun (domaine sans capacite mail
   ou inexistant). */
async function aUnServeurMail(domaine) {
  try {
    const enregistrements = await dns.resolveMx(domaine);
    return enregistrements.length > 0;
  } catch (e) {
    return false;
  }
}

module.exports = async (req, res) => {
  if (!exigerMethode(req, res, 'POST')) return;

  const d = lireCorps(req);
  const prenom = (d.prenom || '').trim();
  const nom = (d.nom || '').trim();
  const email = (d.email || '').trim().toLowerCase();
  const mdp = d.motDePasse || '';
  const formation = (d.formation || '').trim();

  /* === Validations === */
  if (!prenom || !nom || !email || !mdp) {
    return envoyerJson(res, { succes: false, message: 'Prénom, nom, email et mot de passe sont obligatoires' }, 400);
  }
  if (!emailValide(email)) {
    return envoyerJson(res, { succes: false, message: 'Email invalide' }, 400);
  }
  if (mdp.length < 8 || !/[A-Z]/.test(mdp) || !/[0-9]/.test(mdp)) {
    return envoyerJson(res, {
      succes: false,
      message: 'Le mot de passe doit faire au moins 8 caractères, avec une majuscule et un chiffre',
    }, 400);
  }

  /* === Vérifie que le domaine a un serveur mail (MX) === */
  const domaine = email.slice(email.lastIndexOf('@') + 1);
  if (!domaine || !(await aUnServeurMail(domaine))) {
    return envoyerJson(res, { succes: false, message: 'Cette adresse email semble introuvable : vérifiez le domaine.' }, 422);
  }

  /* === Refus des adresses email jetables / temporaires === */
  if (DOMAINES_JETABLES.includes(domaine)) {
    return envoyerJson(res, {
      succes: false,
      message: 'Les adresses email temporaires ne sont pas acceptées. Utilisez une adresse personnelle ou professionnelle.',
    }, 422);
  }

  /* Anti-bruteforce : 10 tentatives / 15 min par IP + email. */
  const ip = obtenirIp(req);
  const rateOk = await verifierRateLimit('creer-' + ip + '-' + email, 10, 900, ip);
  if (!rateOk) {
    return envoyerJson(res, { succes: false, message: 'Trop de tentatives, réessayez dans 15 minutes.' }, 429);
  }

  /* === Verrou anti-doublon (2 inscriptions simultanées, même email) === */
  const verrou = await acquerirVerrouCreation(email);
  if (!verrou) {
    return envoyerJson(res, { succes: false, message: 'Trop de tentatives, réessayez dans 15 minutes.' }, 429);
  }

  /* === Section critique protégée par le verrou : vérifier + créer === */
  let creation;
  try {
    if (await chercherCompteParEmail(email)) {
      return envoyerJson(res, { succes: false, message: 'Un compte existe déjà avec cet email' }, 409);
    }

    const hashe = await hashMdp(mdp);

    creation = await appelerNotion('POST', 'pages', {
      parent: { database_id: process.env.NOTION_DATABASE_COMPTES_ID },
      properties: {
        Email: { title: [{ text: { content: email } }] },
        'Mot de passe': { rich_text: [{ text: { content: hashe } }] },
        Prenom: { rich_text: [{ text: { content: prenom } }] },
        Nom: { rich_text: [{ text: { content: nom } }] },
        Statut: { select: { name: 'Standard' } },
      },
    });
  } finally {
    /* Relâché dès la fin de la section critique — pas besoin de
       bloquer les autres requêtes pendant CRM/webhook/cookie ci-dessous.
       Filet de sécurité aussi sur les sorties anticipées (409/500)
       ci-dessus, sans attendre le TTL de 5s. */
    await libererVerrou(verrou);
  }

  if (!creation) {
    return envoyerJson(res, { succes: false, message: 'Erreur serveur lors de la création du compte' }, 500);
  }

  /* === Sync CRM (Pipeline=Lead, Source=Création compte) === */
  await synchroniserCRM({
    nomComplet: prenom + ' ' + nom,
    email,
    formation: formation || null,
    source: 'Création compte',
    pipeline: 'Lead',
  });

  /* === Email de bienvenue via n8n === */
  if (process.env.WEBHOOK_N8N_BIENVENUE) {
    await appelerWebhook(process.env.WEBHOOK_N8N_BIENVENUE, { prenom, nom, email, formation });
  }

  /* === Connexion automatique (cookie de session) === */
  const utilisateur = { email, prenom, nom, statut: 'Standard' };
  ecrireCookieSession(res, utilisateur);

  envoyerJson(res, {
    succes: true,
    message: 'Compte créé avec succès',
    utilisateur: { ...utilisateur, estAdmin: estAdmin(email) },
  });
};
