<?php
/* =============================================================
   helpers/comptes.php — Helpers pour la base Notion "Comptes"
   =============================================================
   Centralise la lecture / recherche des comptes utilisateurs.
   ============================================================= */

require_once __DIR__ . '/notion.php';


/* Cherche un compte par email dans la base "Comptes LearnWithUs".
   Retourne la page Notion (tableau) ou null si aucun compte. */
function chercherCompteParEmail($email) {
    return chercherPageNotion(
        NOTION_DS_COMPTES_ID,
        ['property' => 'Email', 'title' => ['equals' => $email]]
    );
}


/* Extrait les champs d'une page Notion "Compte" sous forme
   de tableau associatif simple à manipuler dans le code. */
function lireCompte($page) {
    $props = $page['properties'] ?? [];
    return [
        'id'     => $page['id'] ?? '',
        'email'  => $props['Email']['title'][0]['text']['content']        ?? '',
        'hash'   => $props['Mot de passe']['rich_text'][0]['text']['content'] ?? '',
        'prenom' => $props['Prenom']['rich_text'][0]['text']['content']   ?? '',
        'nom'    => $props['Nom']['rich_text'][0]['text']['content']      ?? '',
        'statut' => $props['Statut']['select']['name']                    ?? 'Standard'
    ];
}
