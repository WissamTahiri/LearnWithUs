/* =============================================================
   api/_lib/comptes.js — Helpers pour la base Notion "Comptes"
   =============================================================
   Equivalent Node de backend-php/helpers/comptes.php.
   ============================================================= */

const { chercherPageNotion } = require('./notion');

/* Cherche un compte par email dans la base "Comptes LearnWithUs".
   Retourne la page Notion (objet) ou null si aucun compte. */
function chercherCompteParEmail(email) {
  return chercherPageNotion(process.env.NOTION_DS_COMPTES_ID, {
    property: 'Email',
    title: { equals: email },
  });
}

/* Extrait les champs d'une page Notion "Compte" sous forme
   d'objet simple a manipuler dans le code. */
function lireCompte(page) {
  const props = (page && page.properties) || {};
  return {
    id: (page && page.id) || '',
    email: props.Email?.title?.[0]?.text?.content || '',
    hash: props['Mot de passe']?.rich_text?.[0]?.text?.content || '',
    prenom: props.Prenom?.rich_text?.[0]?.text?.content || '',
    nom: props.Nom?.rich_text?.[0]?.text?.content || '',
    statut: props.Statut?.select?.name || 'Standard',
  };
}

module.exports = { chercherCompteParEmail, lireCompte };
