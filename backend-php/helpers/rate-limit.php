<?php
/* =============================================================
   helpers/rate-limit.php — Limitation du nombre de tentatives
   =============================================================
   Anti-bruteforce simple, basé sur un fichier JSON par clé.
   Pas de base de données, pas de Redis : un fichier dans data/
   suffit largement pour un projet école.

   Principe : on stocke la liste des timestamps des tentatives,
   on garde celles dans la fenêtre, et on refuse si > seuil.
   ============================================================= */


/* Vérifie si la clé peut effectuer une nouvelle tentative.
   - $cle           : ex 'connexion-1.2.3.4'
   - $maxTentatives : nombre max de tentatives dans la fenêtre
   - $fenetreSec    : durée de la fenêtre en secondes
   Retourne true si OK (et enregistre la tentative), false si limité. */
function verifierRateLimit($cle, $maxTentatives = 5, $fenetreSec = 900) {

    $dossier = __DIR__ . '/../data';
    if (!is_dir($dossier)) mkdir($dossier, 0755, true);

    /* Nettoie la clé pour qu'elle soit utilisable comme nom de fichier */
    $cleSafe = preg_replace('/[^a-zA-Z0-9_.-]/', '_', $cle);
    $fichier = $dossier . '/rl-' . $cleSafe . '.json';

    $maintenant = time();
    $tentatives = [];

    if (file_exists($fichier)) {
        $contenu = json_decode(file_get_contents($fichier), true);
        if (is_array($contenu)) $tentatives = $contenu;
    }

    /* On garde uniquement les tentatives dans la fenêtre */
    $tentatives = array_values(array_filter(
        $tentatives,
        fn($t) => $t > $maintenant - $fenetreSec
    ));

    if (count($tentatives) >= $maxTentatives) {
        return false;  /* Limite atteinte */
    }

    /* Enregistre la nouvelle tentative et persiste sur disque */
    $tentatives[] = $maintenant;
    file_put_contents($fichier, json_encode($tentatives));
    return true;
}


/* Récupère l'IP du client.
   REMOTE_ADDR est fiable car il vient directement du serveur web.
   X-Forwarded-For est faussable (header HTTP), à éviter sauf
   derrière un proxy de confiance dont on contrôle la config. */
function obtenirIp() {
    return $_SERVER['REMOTE_ADDR'] ?? 'inconnu';
}
