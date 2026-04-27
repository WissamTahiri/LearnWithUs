<?php
/* =============================================================
   api/contact.php — Formulaire de contact
   =============================================================
   1. Reçoit un message du formulaire contact (front)
   2. Envoie au webhook n8n #2 (accusé étudiant + notif équipe)
   3. Synchronise dans le CRM Notion (Pipeline = "Lead")
   ============================================================= */

require_once __DIR__ . '/_init.php';
require_once __DIR__ . '/../helpers/webhook.php';
require_once __DIR__ . '/../helpers/crm.php';

exigerMethode('POST');

$donnees = lireRequete();
$prenom  = trim($donnees['prenom']  ?? '');
$nom     = trim($donnees['nom']     ?? '');
$email   = trim($donnees['email']   ?? '');
$sujet   = trim($donnees['sujet']   ?? '');
$message = trim($donnees['message'] ?? '');

/* Validation des champs obligatoires */
if (!$prenom || !$email || !$message) {
    repondreJson([
        'succes'  => false,
        'message' => 'Prénom, email et message sont obligatoires'
    ], 400);
}

/* Validation simple du format email */
if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    repondreJson([
        'succes'  => false,
        'message' => 'Email invalide'
    ], 400);
}

/* Webhook n8n : accusé de réception étudiant + notification équipe */
appelerWebhook(WEBHOOK_N8N_CONTACT, [
    'prenom'  => $prenom,
    'nom'     => $nom,
    'email'   => $email,
    'sujet'   => $sujet,
    'message' => $message
]);

/* Ajout du contact dans le CRM Notion (Pipeline = "Lead") */
synchroniserCRM([
    'nomComplet' => trim($prenom . ' ' . $nom),
    'email'      => $email,
    'source'     => 'Formulaire contact',
    'pipeline'   => 'Lead'
]);

repondreJson([
    'succes'  => true,
    'message' => 'Votre message a bien été reçu. Réponse sous 24h.'
]);
