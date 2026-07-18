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
const { acquerirVerrouPremium, libererVerrou } = require('./_lib/rateLimit');

module.exports = async (req, res) => {
  if (!exigerMethode(req, res, 'POST')) return;

  const utilisateur = await exigerConnexion(req, res);
  if (!utilisateur) return;
  const email = utilisateur.email;

  const page = await chercherCompteParEmail(email);
  if (!page) {
    return envoyerJson(res, { succes: false, message: 'Compte introuvable' }, 404);
  }

  /* === Verrou anti-doublon (double-clic / retry réseau quasi simultanés) ===
     Sans verrou, deux requêtes concurrentes pour le même email peuvent
     toutes deux lire statut='Standard' avant que l'une n'ait fini son PATCH
     → double transaction Notion + double webhook de reçu client. Même
     stratégie que creer-compte.js (verrou Redis, TTL 5s, retry-poll ~1,5s). */
  const verrou = await acquerirVerrouPremium(email);
  if (!verrou) {
    return envoyerJson(res, { succes: false, message: 'Le service est momentanément occupé, merci de réessayer dans quelques secondes.' }, 503);
  }

  let dejaPremium = false;
  let reference = null;

  /* === Section critique protégée par le verrou === */
  try {
    /* === Idempotence : si le compte est DÉJÀ Premium, on s'arrête ici ===
       Sans cette garde, un rejeu de la requête (double-clic, refresh du
       formulaire, retour arrière) ré-enregistrerait une transaction 29 € et
       renverrait un nouveau reçu à chaque appel → revenu faussé + spam client.
       On lit le statut réel côté Notion (source de vérité), pas le cookie. */
    const compteActuel = lireCompte(page);
    dejaPremium = compteActuel.statut === 'Premium';

    if (!dejaPremium) {
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
      reference = await enregistrerTransaction({
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
    }
  } finally {
    /* Relâché avant la mise à jour du cookie/réponse — pas besoin de
       bloquer d'autres requêtes pendant ça (comme creer-compte.js). */
    await libererVerrou(verrou);
  }

  /* === Met à jour la session avec le nouveau statut === */
  const uAJour = { email: utilisateur.email, prenom: utilisateur.prenom, nom: utilisateur.nom, statut: 'Premium', estAdmin: utilisateur.estAdmin };
  await ecrireCookieSession(res, uAJour);

  if (dejaPremium) {
    return envoyerJson(res, {
      succes: true,
      message: 'Votre compte est déjà Premium',
      dejaPremium: true,
      utilisateur: uAJour,
    });
  }

  envoyerJson(res, {
    succes: true,
    message: 'Abonnement Premium activé avec succès',
    reference,
    transactionEnregistree: Boolean(reference),
    utilisateur: uAJour,
  });
};
