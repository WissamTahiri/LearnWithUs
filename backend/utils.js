/* utils.js — Helpers purs (sans dépendance Notion / Express).
   Isolés ici pour être testables sans devoir faire tourner le serveur. */


/* Génère une référence de transaction au format TXN-YYYYMMDD-HHMMSS.
   Lisible (date et heure en clair) et triable alphabétiquement. */
function genererReferenceTransaction(date) {
  const d = date || new Date()
  const jour = d.toISOString().slice(0, 10).replace(/-/g, '')
  const heure = d.toISOString().slice(11, 19).replace(/:/g, '')
  return 'TXN-' + jour + '-' + heure
}


/* Teste si un email figure dans la liste des admins (case-insensitive). */
function estAdminEmail(email, adminList) {
  if (!email || !Array.isArray(adminList) || adminList.length === 0) return false
  return adminList.map(a => a.toLowerCase()).includes(email.toLowerCase())
}


/* Valide un mot de passe contre les règles métier.
   Retourne { valide: boolean, message: string }. */
function validerMotDePasse(mdp) {
  if (!mdp || typeof mdp !== 'string') {
    return { valide: false, message: 'Mot de passe manquant' }
  }
  if (mdp.length < 8) {
    return { valide: false, message: 'Le mot de passe doit faire au moins 8 caractères' }
  }
  return { valide: true, message: 'OK' }
}


/* Parse la variable d'environnement ADMIN_EMAILS (chaîne séparée par
   des virgules) et renvoie un tableau propre (trim + lowercase + non-vide). */
function parserAdminEmails(chaine) {
  if (!chaine || typeof chaine !== 'string') return []
  return chaine.split(',').map(e => e.trim().toLowerCase()).filter(e => e.length > 0)
}


module.exports = {
  genererReferenceTransaction,
  estAdminEmail,
  validerMotDePasse,
  parserAdminEmails
}
