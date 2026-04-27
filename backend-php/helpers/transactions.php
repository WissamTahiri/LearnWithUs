<?php
/* =============================================================
   helpers/transactions.php — Enregistrement des paiements
   =============================================================
   Stocke un historique des paiements dans la base Notion
   "Transactions LearnWithUs".

   /!\ ATTENTION RGPD / PCI DSS :
   On ne stocke AUCUNE donnée bancaire (numéro de carte, CVV,
   date d'expiration). Uniquement les métadonnées (email, montant,
   date, référence). Dans un vrai SaaS, le numéro de carte n'arrive
   jamais sur notre serveur — il est envoyé directement à un
   prestataire (Stripe, Adyen) qui nous renvoie un token.
   ============================================================= */

require_once __DIR__ . '/notion.php';


/* Génère une référence unique au format TXN-YYYYMMDD-HHMMSS.
   Lisible et triable alphabétiquement. */
function genererReferenceTransaction() {
    return 'TXN-' . date('Ymd-His');
}


/* Enregistre une transaction dans Notion.
   $donnees attend les clés : email, formation, montant, statut.
   Retourne la référence générée, ou null en cas d'erreur. */
function enregistrerTransaction($donnees) {

    if (!NOTION_DS_TRANSACTIONS_ID) {
        error_log('[Transactions] NOTION_DS_TRANSACTIONS_ID non configuré');
        return null;
    }

    $reference  = genererReferenceTransaction();
    $aujourdhui = date('Y-m-d');

    $reponse = appelerNotion('POST', 'pages', [
        'parent' => ['data_source_id' => NOTION_DS_TRANSACTIONS_ID],
        'properties' => [
            'Référence'    => ['title'  => [['text' => ['content' => $reference]]]],
            'Email client' => ['email'  => $donnees['email']],
            'Formation'    => ['select' => ['name' => $donnees['formation'] ?? 'Premium global']],
            'Montant'      => ['number' => $donnees['montant'] ?? 29],
            'Date'         => ['date'   => ['start' => $aujourdhui]],
            'Statut'       => ['select' => ['name' => $donnees['statut'] ?? 'Validé']]
        ]
    ]);

    return $reponse ? $reference : null;
}
