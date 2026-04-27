<?php
/* =============================================================
   api/admin/stats.php — Dashboard admin (KPI agrégés)
   =============================================================
   Agrège les chiffres clés des 4 bases Notion :
     - Inscriptions (legacy, conservée pour archivage)
     - Comptes (Standard / Premium)
     - CRM (Pipeline)
     - Transactions (revenu)

   Réservé aux emails listés dans ADMIN_EMAILS (config.php).
   ============================================================= */

require_once __DIR__ . '/../_init.php';
require_once __DIR__ . '/../../helpers/auth.php';
require_once __DIR__ . '/../../helpers/notion.php';

exigerMethode('GET');
exigerAdmin();

/* === Récupération des 4 bases ===
   PHP est synchrone : on les charge l'une après l'autre. Pour
   un projet école avec peu de pages, c'est largement assez. */
$inscriptions = listerPagesNotion(NOTION_DS_INSCRIPTIONS_ID);
$comptes      = listerPagesNotion(NOTION_DS_COMPTES_ID);
$crm          = listerPagesNotion(NOTION_DS_CRM_ID);
$transactions = listerPagesNotion(NOTION_DS_TRANSACTIONS_ID);

/* Tri par date de création décroissante (plus récentes en premier) */
$triRecent = function ($a, $b) {
    return strcmp($b['created_time'] ?? '', $a['created_time'] ?? '');
};
usort($inscriptions, $triRecent);
usort($comptes,      $triRecent);
usort($crm,          $triRecent);
usort($transactions, $triRecent);

/* === Comptes : répartition Standard / Premium === */
$comptesParStatut = ['Standard' => 0, 'Premium' => 0];
foreach ($comptes as $c) {
    $statut = $c['properties']['Statut']['select']['name'] ?? 'Standard';
    if ($statut === 'Premium') $comptesParStatut['Premium']++;
    else                       $comptesParStatut['Standard']++;
}

/* === CRM : répartition par formation d'intérêt === */
$crmParFormation = ['IA' => 0, 'SCRUM' => 0, 'SAP' => 0];
foreach ($crm as $c) {
    $f = $c['properties']["Formation d'intérêt"]['select']['name'] ?? null;
    if ($f && isset($crmParFormation[$f])) $crmParFormation[$f]++;
}

/* === CRM : répartition par étape de pipeline === */
$leadsParPipeline = [
    'Lead'            => 0,
    'Contacté'        => 0,
    'Client Standard' => 0,
    'Client Premium'  => 0,
    'Perdu'           => 0
];
foreach ($crm as $l) {
    $p = $l['properties']['Pipeline']['select']['name'] ?? null;
    if ($p && isset($leadsParPipeline[$p])) $leadsParPipeline[$p]++;
}

/* === Transactions : revenu total (somme des "Validé") === */
$totalRevenu = 0;
foreach ($transactions as $t) {
    $statut = $t['properties']['Statut']['select']['name'] ?? '';
    if ($statut !== 'Validé') continue;
    $totalRevenu += $t['properties']['Montant']['number'] ?? 0;
}

/* === 5 dernières inscriptions === */
$dernieresInscriptions = array_map(function ($p) {
    $props = $p['properties'];
    return [
        'prenom'    => $props['Prénom']['title'][0]['text']['content']   ?? '',
        'nom'       => $props['Nom']['rich_text'][0]['text']['content']  ?? '',
        'email'     => $props['Email']['email']                          ?? '',
        'formation' => $props['Formation']['select']['name']             ?? '',
        'date'      => $p['created_time']                                ?? ''
    ];
}, array_slice($inscriptions, 0, 5));

/* === 5 dernières transactions === */
$dernieresTransactions = array_map(function ($t) {
    $props = $t['properties'];
    return [
        'reference' => $props['Référence']['title'][0]['text']['content'] ?? '',
        'email'     => $props['Email client']['email']                    ?? '',
        'formation' => $props['Formation']['select']['name']              ?? '',
        'montant'   => $props['Montant']['number']                        ?? 0,
        'statut'    => $props['Statut']['select']['name']                 ?? '',
        'date'      => $t['created_time']                                 ?? ''
    ];
}, array_slice($transactions, 0, 5));

/* === Tous les comptes (gestion admin : delete + statut) === */
$tousLesComptes = array_map(function ($c) {
    $props = $c['properties'];
    return [
        'email'  => $props['Email']['title'][0]['text']['content']       ?? '',
        'prenom' => $props['Prenom']['rich_text'][0]['text']['content']  ?? '',
        'nom'    => $props['Nom']['rich_text'][0]['text']['content']     ?? '',
        'statut' => $props['Statut']['select']['name']                   ?? 'Standard',
        'date'   => $c['created_time']                                   ?? ''
    ];
}, $comptes);

repondreJson([
    'succes' => true,
    'stats'  => [
        'totalInscriptions'      => count($inscriptions),
        'totalComptes'           => count($comptes),
        'totalLeads'             => count($crm),
        'totalTransactions'      => count($transactions),
        'totalRevenu'            => $totalRevenu,
        'comptesParStatut'       => $comptesParStatut,
        'crmParFormation'        => $crmParFormation,
        'leadsParPipeline'       => $leadsParPipeline,
        'dernieresInscriptions'  => $dernieresInscriptions,
        'dernieresTransactions'  => $dernieresTransactions,
        'tousLesComptes'         => $tousLesComptes
    ]
]);
