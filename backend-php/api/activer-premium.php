<?php
/* =============================================================
   api/activer-premium.php — Bascule du compte Standard → Premium
   =============================================================
   Appelée après le formulaire de paiement fictif.
   Pas de vrai Stripe : on simule un paiement validé.
   1. Vérifie que l'utilisateur est connecté (session)
   2. Met à jour le statut Notion → "Premium"
   3. Met à jour le CRM (Pipeline = Client Premium)
   4. Enregistre la transaction (référence + montant 29€)
   5. Webhook n8n (reçu client + notif équipe)
   6. Met à jour la session avec le nouveau statut
   ============================================================= */

require_once __DIR__ . '/_init.php';
require_once __DIR__ . '/../helpers/auth.php';
require_once __DIR__ . '/../helpers/comptes.php';
require_once __DIR__ . '/../helpers/notion.php';
require_once __DIR__ . '/../helpers/crm.php';
require_once __DIR__ . '/../helpers/transactions.php';
require_once __DIR__ . '/../helpers/webhook.php';

exigerMethode('POST');

$utilisateur = exigerConnexion();
$email       = $utilisateur['email'];

$page = chercherCompteParEmail($email);
if (!$page) {
    repondreJson([
        'succes'  => false,
        'message' => 'Compte introuvable'
    ], 404);
}

/* === Bascule du Statut Notion → Premium === */
$majStatut = appelerNotion('PATCH', 'pages/' . $page['id'], [
    'properties' => [
        'Statut' => ['select' => ['name' => 'Premium']]
    ]
]);

if (!$majStatut) {
    repondreJson([
        'succes'  => false,
        'message' => 'Erreur lors de l\'activation Premium'
    ], 500);
}

/* === CRM : Pipeline → Client Premium === */
synchroniserCRM([
    'email'    => $email,
    'source'   => 'Paiement Premium',
    'pipeline' => 'Client Premium'
]);

/* === Enregistre la transaction (sans donnée bancaire) === */
$reference = enregistrerTransaction([
    'email'     => $email,
    'formation' => 'Premium global',
    'montant'   => 29,
    'statut'    => 'Validé'
]);

/* === Webhook n8n #4 (paiement) : reçu client + notif équipe === */
if (WEBHOOK_N8N_PAIEMENT) {
    $compte = lireCompte($page);
    appelerWebhook(WEBHOOK_N8N_PAIEMENT, [
        'email'     => $email,
        'prenom'    => $compte['prenom'],
        'nom'       => $compte['nom'],
        'reference' => $reference,
        'montant'   => 29,
        'formation' => 'Premium global',
        'date'      => date('Y-m-d')
    ]);
}

/* === Met à jour la session avec le nouveau statut === */
$utilisateur['statut'] = 'Premium';
connecterUtilisateur($utilisateur);

repondreJson([
    'succes'      => true,
    'message'     => 'Abonnement Premium activé avec succès',
    'reference'   => $reference,
    'utilisateur' => $utilisateur
]);
