/* =============================================================
   api/admin/supprimer-compte.js — Admin archive un compte
   =============================================================
   Permet à un admin d'archiver le compte de n'importe quel
   utilisateur. Refuse si l'admin tente de supprimer son propre
   compte (utiliser /api/supprimer-compte.js pour ça).
   ============================================================= */

const { lireCorps, envoyerJson, exigerMethode } = require('../_lib/http');
const { exigerAdmin } = require('../_lib/auth');
const { chercherCompteParEmail } = require('../_lib/comptes');
const { appelerNotion } = require('../_lib/notion');

module.exports = async (req, res) => {
  if (!exigerMethode(req, res, 'POST')) return;
  const admin = exigerAdmin(req, res);
  if (!admin) return;

  const d = lireCorps(req);
  const emailCible = (d.email || '').trim().toLowerCase();

  if (!emailCible) {
    return envoyerJson(res, { succes: false, message: 'Email obligatoire' }, 400);
  }

  if (emailCible === admin.email.toLowerCase()) {
    return envoyerJson(res, {
      succes: false,
      message: 'Vous ne pouvez pas supprimer votre propre compte via cette route',
    }, 400);
  }

  const page = await chercherCompteParEmail(emailCible);
  if (!page) {
    return envoyerJson(res, { succes: false, message: 'Compte introuvable' }, 404);
  }

  const archive = await appelerNotion('PATCH', 'pages/' + page.id, { archived: true });
  if (!archive) {
    return envoyerJson(res, { succes: false, message: 'Erreur lors de la suppression' }, 500);
  }

  envoyerJson(res, { succes: true, message: 'Compte de ' + emailCible + ' supprimé' });
};
