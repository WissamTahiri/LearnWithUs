<?php
/* =============================================================
   helpers/token.php — Tokens HMAC pour les liens email
   =============================================================
   Petit "JWT maison" en pur PHP, sans librairie externe.
   Utilisé pour les liens envoyés par email :
   - reset mot de passe (purpose='reset', durée 15 min)

   Format : <payload_base64>.<signature_hmac>
   Le payload contient email|purpose|exp et n'est pas chiffré
   (juste signé). Tout serveur qui connaît APP_SECRET peut vérifier.
   ============================================================= */

require_once __DIR__ . '/../config.php';


/* Génère un token signé. Retourne la chaîne url-safe à insérer dans le lien.
   - $email    : email du compte concerné
   - $purpose  : raison du token ('reset' ou 'verification')
   - $dureeSec : durée de validité en secondes */
function genererToken($email, $purpose, $dureeSec, $liaison = '') {
    $exp     = time() + $dureeSec;
    /* $liaison = valeur qui LIE le token à un état serveur (ex : empreinte du
       hash actuel du mot de passe). Résultat : usage unique — dès que cet état
       change (mdp modifié), l'empreinte change et le token ne valide plus. */
    $charge  = $email . '|' . $purpose . '|' . $exp . '|' . $liaison;
    $payload = base64UrlEncode($charge);
    $sig     = hash_hmac('sha256', $payload, APP_SECRET);
    return $payload . '.' . $sig;
}


/* Vérifie un token et retourne {email, purpose, exp} si valide,
   ou null si signature invalide / token expiré / mauvais purpose. */
function verifierToken($token, $purposeAttendu) {

    if (!$token || strpos($token, '.') === false) return null;

    list($payload, $sig) = explode('.', $token, 2);

    /* hash_equals = comparaison en temps constant (anti-timing attack) */
    $sigAttendue = hash_hmac('sha256', $payload, APP_SECRET);
    if (!hash_equals($sigAttendue, $sig)) return null;

    $charge = base64UrlDecode($payload);
    if (!$charge) return null;

    $parties = explode('|', $charge);
    if (count($parties) !== 4) return null;

    list($email, $purpose, $exp, $liaison) = $parties;

    if ($purpose !== $purposeAttendu) return null;
    if (time() > (int)$exp)            return null;

    return ['email' => $email, 'purpose' => $purpose, 'exp' => (int)$exp, 'liaison' => $liaison];
}


/* Encodage base64 url-safe (sans / + =) — compatible URL. */
function base64UrlEncode($s) {
    return rtrim(strtr(base64_encode($s), '+/', '-_'), '=');
}

function base64UrlDecode($s) {
    $s2     = strtr($s, '-_', '+/');
    $padded = str_pad($s2, strlen($s2) + (4 - strlen($s2) % 4) % 4, '=');
    return base64_decode($padded);
}
