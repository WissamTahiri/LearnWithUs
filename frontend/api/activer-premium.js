/* =============================================================
   api/activer-premium.js — Bascule du compte Standard → Premium
   =============================================================
   Appelée après le formulaire de paiement fictif. Pas de vrai
   Stripe : on simule un paiement validé.
   ============================================================= */

const { envoyerJson, exigerMethode } = require('./_lib/http');
const { exigerConnexion } = require('./_lib/auth');
const { chercherCompteParEmail, lireCompte } = require('./_lib/comptes');
const { appelerNotion } = require('./_lib/notion');
const { synchroniserCRM } = require('./_lib/crm');
const { enregistrerTransaction } = require('./_lib/transactions');
const { appelerWebhook } = require('./_lib/webhook');
const { ecrireCookieSession } = require('./_lib/cookie');

module.exports = async (req, res) => {
  if (!exigerMethode(req, res, 'POST')) return;

  const utilisateur = exigerConnexion(req, res);
  if (!utilisateur) return;
  const email = utilisateur.email;

  const page = await chercherCompteParEmail(email);
  if (!page) {
    return envoyerJson(res, { succes: false, message: 'Compte introuvable' }, 404);
  }

  /* === Idempotence : si le compte est DÉJÀ Premium, on s'arrête ici ===
     Sans cette garde, un rejeu de la requête (double-clic, refresh du
     formulaire, retour arrière) ré-enregistrerait une transaction 29 € et
     renverrait un nouveau reçu à chaque appel → revenu faussé + spam client.
     On lit le statut réel côté Notion (source de vérité), pas le cookie. */
  const compteActuel = lireCompte(page);
  if (compteActuel.statut === 'Premium') {
    const uAJour = { email: utilisateur.email, prenom: utilisateur.prenom, nom: utilisateur.nom, statut: 'Premium', estAdmin: utilisateur.estAdmin };
    ecrireCookieSession(res, uAJour);
    return envoyerJson(res, {
      succes: true,
      message: 'Votre compte est déjà Premium',
      dejaPremium: true,
      utilisateur: uAJour,
    });
  }

  /* === Bascule du Statut Notion → Premium === */
  const majStatut = await appelerNotion('PATCH', 'pages/' + page.id, {
    properties: { Statut: { select: { name: 'Premium' } } },
  });

  if (!majStatut) {
    return envoyerJson(res, { succes: false, message: "Erreur lors de l'activation Premium" }, 500);
  }

  /* === CRM : Pipeline → Client Premium === */
  await synchroniserCRM({ email, source: 'Paiement Premium', pipeline: 'Client Premium' });

  /* === Enregistre la transaction (sans donnée bancaire) === */
  const reference = await enregistrerTransaction({
    email,
    formation: 'Premium global',
    montant: 29,
    statut: 'Validé',
  });

  /* L'échec d'enregistrement ne doit pas casser l'activation Premium, mais on
     ne veut plus d'échec SILENCIEUX. */
  if (!reference) {
    console.error(
      '[Paiement] Transaction Notion NON enregistrée pour ' + email +
      " — verifier le partage de la base Transactions avec l'integration Notion."
    );
  }

  /* === Webhook n8n #4 (paiement) : reçu client + notif équipe === */
  if (process.env.WEBHOOK_N8N_PAIEMENT) {
    const compte = lireCompte(page);
    await appelerWebhook(process.env.WEBHOOK_N8N_PAIEMENT, {
      email,
      prenom: compte.prenom,
      nom: compte.nom,
      reference,
      montant: 29,
      formation: 'Premium global',
      date: new Date().toISOString().slice(0, 10),
    });
  }

  /* === Met à jour la session avec le nouveau statut === */
  const uAJour = { email: utilisateur.email, prenom: utilisateur.prenom, nom: utilisateur.nom, statut: 'Premium', estAdmin: utilisateur.estAdmin };
  ecrireCookieSession(res, uAJour);

  envoyerJson(res, {
    succes: true,
    message: 'Abonnement Premium activé avec succès',
    reference,
    transactionEnregistree: Boolean(reference),
    utilisateur: uAJour,
  });
};
