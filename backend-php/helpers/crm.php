<?php
/* =============================================================
   helpers/crm.php — Synchronisation du CRM Notion (upsert)
   =============================================================
   Centralise tous les leads et clients dans la base "CRM
   LearnWithUs" sur Notion. Une seule entrée par email :
   - si l'email existe déjà → mise à jour pipeline + dernière action
   - sinon → création avec Pipeline = "Lead" par défaut
   Appelée depuis : contact, creer-compte, activer-premium.
   ============================================================= */

require_once __DIR__ . '/notion.php';


/* Cherche un contact dans le CRM par son email.
   Retourne la page Notion ou null. */
function chercherContactCRM($email) {
    return chercherPageNotion(
        NOTION_DS_CRM_ID,
        ['property' => 'Email', 'email' => ['equals' => $email]]
    );
}


/* Crée ou met à jour un contact dans le CRM.
   $donnees attend les clés : nomComplet, email, source (opt),
   formation (opt), pipeline (opt). */
function synchroniserCRM($donnees) {

    /* Si l'ID CRM n'est pas configuré (TODO), on saute en silence */
    if (!NOTION_DS_CRM_ID || NOTION_DS_CRM_ID === 'TODO_NOTION_DS_CRM_ID') {
        error_log('[CRM] NOTION_DS_CRM_ID non configuré, sync ignorée');
        return;
    }

    $email = $donnees['email'] ?? '';
    if (!$email) return;

    $aujourdhui = date('Y-m-d');
    $existant   = chercherContactCRM($email);

    if ($existant) {
        /* === MISE À JOUR ===
           On ne touche qu'aux champs fournis pour ne pas écraser
           des données existantes par des valeurs vides. */
        $maj = [
            'Dernière action' => ['date' => ['start' => $aujourdhui]]
        ];
        if (!empty($donnees['pipeline'])) {
            $maj['Pipeline'] = ['select' => ['name' => $donnees['pipeline']]];
        }
        appelerNotion('PATCH', 'pages/' . $existant['id'], ['properties' => $maj]);

    } else {
        /* === CRÉATION === */
        $props = [
            'Nom complet'      => ['title'    => [['text' => ['content' => $donnees['nomComplet'] ?? $email]]]],
            'Email'            => ['email'    => $email],
            'Source'           => ['select'   => ['name' => $donnees['source'] ?? 'Autre']],
            'Pipeline'         => ['select'   => ['name' => $donnees['pipeline'] ?? 'Lead']],
            'Date 1er contact' => ['date'     => ['start' => $aujourdhui]],
            'Dernière action'  => ['date'     => ['start' => $aujourdhui]]
        ];
        if (!empty($donnees['formation'])) {
            $props["Formation d'intérêt"] = ['select' => ['name' => $donnees['formation']]];
        }

        appelerNotion('POST', 'pages', [
            'parent'     => ['data_source_id' => NOTION_DS_CRM_ID],
            'properties' => $props
        ]);
    }
}
