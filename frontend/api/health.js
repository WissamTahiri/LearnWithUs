/* =============================================================
   api/health.js — Sonde de sante
   =============================================================
   Equivalent Node de backend-php/api/health.php. Aucune methode
   imposee, aucune auth. Seule route qui n'utilise PAS la cle
   "succes" (a preserve tel quel, incoherence volontaire du PHP
   original conservee pour ne rien casser).
   ============================================================= */

const { envoyerJson } = require('./_lib/http');

module.exports = (req, res) => {
  envoyerJson(res, {
    statut: 'ok',
    service: 'LearnWithUs API (Node)',
    heure: new Date().toISOString(),
  });
};
