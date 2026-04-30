/* main.js — JavaScript principal de LearnWithUs
   Chargé sur toutes les pages. Gère : menu mobile, formulaires,
   onglets espace client, accordéon FAQ, authentification.

   Backend : PHP servi par MAMP/IONOS (anciennement Node.js sur Render).
   Authentification : sessions PHP natives (cookie), plus de JWT.
   Le cookie de session est envoyé automatiquement par le navigateur. */


/* URL du backend — préfixe ajouté à chaque appel fetch.
   - Local MAMP   : '/backend-php' (PHP servi à côté du frontend)
   - Prod IONOS   : '' (PHP servi sous le même domaine que le front)
   En IONOS on basculera ici en J6. */
const URL_BACKEND = '/backend-php'

/* Clé localStorage pour la session utilisateur.
   /!\ La session "réelle" est côté serveur (cookie PHP). Cette clé
   sert uniquement de cache pour afficher rapidement la pastille
   prénom dans la nav sans appel API au chargement. Le serveur reste
   la source de vérité — si le cookie est expiré, les routes API
   répondront 401 et on déconnectera l'utilisateur. */
const CLE_SESSION = 'learnwithus_session'

/* Options communes à tous les fetch :
   - credentials:'include' force l'envoi du cookie de session, même
     en cross-origin (utile si on déploie front et back sur des
     sous-domaines différents un jour). */
const OPTIONS_FETCH = { credentials: 'include' }


/* ===== SESSION UTILISATEUR (cache localStorage) ===== */

/* Lit le cache local. Retourne null si aucun utilisateur connu. */
function lireSession() {
  const donnees = localStorage.getItem(CLE_SESSION)
  if (!donnees) return null
  try {
    return JSON.parse(donnees)
  } catch (e) {
    return null
  }
}

/* Met à jour le cache après connexion/inscription/paiement Premium. */
function sauverSession(utilisateur) {
  localStorage.setItem(CLE_SESSION, JSON.stringify({ utilisateur: utilisateur }))
}

/* Déconnecte : appelle le backend pour détruire la session côté
   serveur, puis vide le cache local et redirige vers l'accueil. */
async function deconnecter() {
  try {
    await fetch(URL_BACKEND + '/api/deconnexion.php', {
      method: 'POST',
      credentials: 'include'
    })
  } catch (e) {
    /* Réseau indisponible : on déconnecte au moins côté client */
  }
  localStorage.removeItem(CLE_SESSION)
  window.location.href = 'index.html'
}


/* Met à jour la nav selon l'état de connexion (cache localStorage) :
   - non connecté : lien "Connexion" visible
   - connecté    : pastille prénom + lien "Déconnexion" + (admin) */
function majNavigation() {
  const session = lireSession()
  const liensNav = document.querySelector('.nav-liens')
  if (!liensNav) return

  const lienConnexion = liensNav.querySelector('a[href="connexion.html"]')

  if (session && session.utilisateur && lienConnexion) {
    /* Pastille bordeaux : mène à la page de paramètres du compte
       (comme un avatar profil sur LinkedIn / Twitter). */
    const parent = lienConnexion.parentElement
    parent.innerHTML =
      '<a href="parametres.html" class="badge-utilisateur">' +
        session.utilisateur.prenom +
      '</a>'

    /* Lien admin uniquement si estAdmin est vrai (calcul serveur) */
    if (session.utilisateur.estAdmin) {
      const liAdmin = document.createElement('li')
      liAdmin.innerHTML =
        '<a href="admin.html" class="lien-admin">Admin</a>'
      liensNav.appendChild(liAdmin)
    }

    const liDeconnexion = document.createElement('li')
    liDeconnexion.innerHTML =
      '<a href="#" onclick="deconnecter(); return false;">Déconnexion</a>'
    liensNav.appendChild(liDeconnexion)
  }
}


/* Ouvre/ferme le menu de navigation sur mobile */
function gereMenuMobile() {
  const liensNavigation = document.querySelector('.nav-liens')
  liensNavigation.classList.toggle('menu-ouvert')
}


/* Envoie le formulaire de contact au backend PHP */
async function envoyeContact(evenement) {
  evenement.preventDefault()

  const donneesContact = {
    prenom:  document.getElementById('contact-prenom').value,
    nom:     document.getElementById('contact-nom').value,
    email:   document.getElementById('contact-email').value,
    sujet:   document.getElementById('contact-sujet').value,
    message: document.getElementById('contact-message').value
  }

  const boutonEnvoi = evenement.target.querySelector('button[type="submit"]')
  const texteOriginal = boutonEnvoi.textContent
  boutonEnvoi.disabled = true
  boutonEnvoi.textContent = 'Envoi en cours...'

  try {
    const reponse = await fetch(URL_BACKEND + '/api/contact.php', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body:    JSON.stringify(donneesContact)
    })

    const resultat = await reponse.json()
    const zoneMessage = document.getElementById('message-contact')

    if (resultat.succes) {
      zoneMessage.className = 'message-succes'
      zoneMessage.textContent =
        'Merci ' + donneesContact.prenom + ' ! ' +
        'Votre message a bien été reçu. Nous vous répondrons sous 24h.'
      document.getElementById('form-contact').reset()
    } else {
      zoneMessage.className = 'message-erreur'
      zoneMessage.textContent =
        resultat.message || 'Une erreur est survenue. Veuillez réessayer.'
    }

  } catch (erreur) {
    console.error('Erreur lors de l\'envoi du contact :', erreur)
    const zoneMessage = document.getElementById('message-contact')
    zoneMessage.className = 'message-erreur'
    zoneMessage.textContent =
      'Impossible de contacter le serveur. Vérifiez votre connexion et réessayez.'
  }

  boutonEnvoi.disabled = false
  boutonEnvoi.textContent = texteOriginal
}


/* Affiche le contenu de l'onglet demandé, cache les autres */
function basculerOnglet(nomOnglet) {
  document.querySelectorAll('.onglet-contenu').forEach(function(contenu) {
    contenu.classList.remove('actif')
  })

  document.querySelectorAll('.onglet-bouton').forEach(function(bouton) {
    bouton.classList.remove('actif')
  })

  const contenuCible = document.getElementById('contenu-' + nomOnglet)
  if (contenuCible) {
    contenuCible.classList.add('actif')
  }

  document.querySelectorAll('.onglet-bouton').forEach(function(bouton) {
    if (bouton.textContent.toLowerCase().includes(nomOnglet)) {
      bouton.classList.add('actif')
    }
  })
}


/* Ouvre la réponse FAQ cliquée, ferme les autres */
function basculerFAQ(bouton) {
  const element = bouton.parentElement
  const estDejaOuvert = element.classList.contains('ouvert')

  document.querySelectorAll('.accordeon-element').forEach(function(el) {
    el.classList.remove('ouvert')
  })

  if (!estDejaOuvert) {
    element.classList.add('ouvert')
  }
}


/* ===== AUTHENTIFICATION ===== */

/* Envoie le formulaire de création de compte au backend.
   Le serveur ouvre directement la session (cookie posé) si succès. */
async function envoyerCreationCompte(evenement) {
  evenement.preventDefault()

  const prenom           = document.getElementById('prenom').value.trim()
  const nom              = document.getElementById('nom').value.trim()
  const email            = document.getElementById('email').value.trim()
  const formation        = document.getElementById('formation').value
  const motDePasse       = document.getElementById('mot-de-passe').value
  const confirmationMdp  = document.getElementById('confirmation-mdp').value
  const cguAcceptees     = document.getElementById('cgu').checked

  const zoneMessage = document.getElementById('message-auth')

  /* Vérifications côté client avant envoi backend */
  if (motDePasse !== confirmationMdp) {
    zoneMessage.className = 'message-erreur'
    zoneMessage.textContent = 'Les deux mots de passe ne correspondent pas.'
    return
  }
  if (motDePasse.length < 8) {
    zoneMessage.className = 'message-erreur'
    zoneMessage.textContent = 'Le mot de passe doit faire au moins 8 caractères.'
    return
  }
  if (!cguAcceptees) {
    zoneMessage.className = 'message-erreur'
    zoneMessage.textContent = 'Vous devez accepter les conditions d\'utilisation.'
    return
  }

  const boutonEnvoi = evenement.target.querySelector('button[type="submit"]')
  const texteOriginal = boutonEnvoi.textContent
  boutonEnvoi.disabled = true
  boutonEnvoi.textContent = 'Création du compte...'

  try {
    const reponse = await fetch(URL_BACKEND + '/api/creer-compte.php', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body:    JSON.stringify({ prenom, nom, email, formation, motDePasse })
    })
    const resultat = await reponse.json()

    if (resultat.succes) {
      sauverSession(resultat.utilisateur)
      zoneMessage.className = 'message-succes'
      zoneMessage.textContent = 'Compte créé ! Redirection en cours...'
      setTimeout(function() {
        window.location.href = 'espace-client.html'
      }, 1200)
    } else {
      zoneMessage.className = 'message-erreur'
      zoneMessage.textContent = resultat.message || 'Erreur lors de la création du compte.'
    }
  } catch (erreur) {
    console.error('Erreur création compte :', erreur)
    zoneMessage.className = 'message-erreur'
    zoneMessage.textContent = 'Impossible de contacter le serveur. Réessayez.'
  }

  boutonEnvoi.disabled = false
  boutonEnvoi.textContent = texteOriginal
}


/* Envoie le formulaire de connexion au backend. */
async function envoyerConnexion(evenement) {
  evenement.preventDefault()

  const email      = document.getElementById('email').value.trim()
  const motDePasse = document.getElementById('mot-de-passe').value

  const zoneMessage = document.getElementById('message-auth')
  const boutonEnvoi = evenement.target.querySelector('button[type="submit"]')
  const texteOriginal = boutonEnvoi.textContent
  boutonEnvoi.disabled = true
  boutonEnvoi.textContent = 'Connexion...'

  try {
    const reponse = await fetch(URL_BACKEND + '/api/connexion.php', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body:    JSON.stringify({ email, motDePasse })
    })
    const resultat = await reponse.json()

    if (resultat.succes) {
      sauverSession(resultat.utilisateur)
      zoneMessage.className = 'message-succes'
      zoneMessage.textContent = 'Connexion réussie ! Redirection...'
      setTimeout(function() {
        window.location.href = 'espace-client.html'
      }, 800)
    } else {
      zoneMessage.className = 'message-erreur'
      zoneMessage.textContent = resultat.message || 'Email ou mot de passe incorrect.'
    }
  } catch (erreur) {
    console.error('Erreur connexion :', erreur)
    zoneMessage.className = 'message-erreur'
    zoneMessage.textContent = 'Impossible de contacter le serveur. Réessayez.'
  }

  boutonEnvoi.disabled = false
  boutonEnvoi.textContent = texteOriginal
}


/* ===== PAGE DE PAIEMENT =====
   Initialise paiement.html selon l'état de l'utilisateur :
   - non connecté : invitation à créer un compte / se connecter
   - déjà Premium : message + lien vers l'espace client
   - Standard connecté : affiche le formulaire de carte */
function initialiserPagePaiement() {
  const vueFormulaire = document.getElementById('vue-formulaire')
  const conteneur     = document.getElementById('conteneur-paiement')
  if (!vueFormulaire || !conteneur) return

  const session = lireSession()

  /* Cas 1 : non connecté */
  if (!session || !session.utilisateur) {
    vueFormulaire.style.display = 'none'
    conteneur.insertAdjacentHTML('beforeend',
      '<div class="etat-special">' +
        '<h2>🔒 Connexion requise</h2>' +
        '<p>Pour souscrire à l\'offre Premium, créez d\'abord un compte gratuit ou connectez-vous.</p>' +
        '<a href="connexion.html" class="bouton-principal">Se connecter</a>' +
        ' <a href="inscription-compte.html" class="bouton-secondaire">Créer un compte</a>' +
      '</div>')
    return
  }

  /* Cas 2 : déjà Premium */
  if (session.utilisateur.statut === 'Premium') {
    vueFormulaire.style.display = 'none'
    conteneur.insertAdjacentHTML('beforeend',
      '<div class="etat-special">' +
        '<h2>⭐ Vous êtes déjà Premium</h2>' +
        '<p>Votre abonnement est actif. Profitez de l\'intégralité des cours, vidéos et supports.</p>' +
        '<a href="espace-client.html" class="bouton-principal">Accéder à mon espace</a>' +
      '</div>')
    return
  }

  /* Cas 3 : Standard connecté */
  brancherFormatsCarte()
  document.getElementById('formulaire-paiement')
    .addEventListener('submit', envoyerPaiement)
}


/* Formate les champs de la carte à la volée. */
function brancherFormatsCarte() {
  const numeroCarte = document.getElementById('numero-carte')
  const expiration  = document.getElementById('expiration')
  const cvv         = document.getElementById('cvv')

  numeroCarte.addEventListener('input', function() {
    const chiffres = numeroCarte.value.replace(/\D/g, '').slice(0, 16)
    numeroCarte.value = chiffres.replace(/(.{4})/g, '$1 ').trim()
  })

  expiration.addEventListener('input', function() {
    let chiffres = expiration.value.replace(/\D/g, '').slice(0, 4)
    if (chiffres.length >= 3) {
      chiffres = chiffres.slice(0, 2) + '/' + chiffres.slice(2)
    }
    expiration.value = chiffres
  })

  cvv.addEventListener('input', function() {
    cvv.value = cvv.value.replace(/\D/g, '').slice(0, 4)
  })
}


/* Envoie l'activation Premium au backend (via la session cookie).
   Aucune donnée bancaire transmise. */
async function envoyerPaiement(evenement) {
  evenement.preventDefault()

  const zoneMessage = document.getElementById('message-paiement')
  const bouton      = evenement.target.querySelector('button[type="submit"]')
  const texteInitial = bouton.textContent

  /* Vérifications visuelles côté client */
  const numero = document.getElementById('numero-carte').value.replace(/\s/g, '')
  const expi   = document.getElementById('expiration').value
  const cvv    = document.getElementById('cvv').value
  const nom    = document.getElementById('nom-carte').value.trim()

  if (nom.length < 2 || numero.length < 13 || !/^\d\d\/\d\d$/.test(expi) || cvv.length < 3) {
    zoneMessage.className = 'message-erreur'
    zoneMessage.textContent = 'Merci de vérifier les informations de la carte.'
    return
  }

  bouton.disabled = true
  bouton.textContent = 'Paiement en cours...'

  try {
    const reponse = await fetch(URL_BACKEND + '/api/activer-premium.php', {
      method:  'POST',
      credentials: 'include'
    })
    const resultat = await reponse.json()

    if (resultat.succes) {
      sauverSession(resultat.utilisateur)
      zoneMessage.className = 'message-succes'
      zoneMessage.textContent = '✅ Paiement validé ! Votre abonnement Premium est actif. Redirection...'
      setTimeout(function() {
        window.location.href = 'espace-client.html'
      }, 1500)
    } else {
      zoneMessage.className = 'message-erreur'
      zoneMessage.textContent = resultat.message || 'Erreur lors du paiement. Réessayez.'
      bouton.disabled = false
      bouton.textContent = texteInitial
    }

  } catch (erreur) {
    console.error('Erreur paiement :', erreur)
    zoneMessage.className = 'message-erreur'
    zoneMessage.textContent = 'Impossible de contacter le serveur. Réessayez.'
    bouton.disabled = false
    bouton.textContent = texteInitial
  }
}


/* ===== PAGES DE FORMATION =====
   Gère l'accès au contenu Premium sur les pages formation-*.html
   - Non connecté : sections Premium floutées + CTA "Créer un compte"
   - Standard     : sections Premium floutées + CTA "Passer Premium"
   - Premium      : tout débloqué */
function configurerAccesFormation() {
  const session = lireSession()
  const estConnecte = !!(session && session.utilisateur)
  const estPremium  = estConnecte && session.utilisateur.statut === 'Premium'

  const sectionsPremium = document.querySelectorAll('.contenu-premium')
  const carteCta        = document.getElementById('cta-premium')

  if (estPremium) {
    sectionsPremium.forEach(function(s) { s.classList.remove('contenu-bloque') })
    if (carteCta) carteCta.style.display = 'none'
  } else {
    sectionsPremium.forEach(function(s) { s.classList.add('contenu-bloque') })

    if (carteCta) {
      const bouton  = carteCta.querySelector('.bouton-cta')
      const message = carteCta.querySelector('.message-cta')
      if (estConnecte) {
        message.textContent =
          'Passez à Premium pour débloquer le cours complet, la vidéo de 10 min et le quiz final.'
        bouton.textContent = 'Passer à Premium'
        bouton.href = 'espace-client.html'
      } else {
        message.textContent =
          'Créez votre compte gratuit pour commencer, puis passez Premium pour tout débloquer.'
        bouton.textContent = 'Créer un compte'
        bouton.href = 'inscription-compte.html'
      }
    }
  }
}


/* Adapte les CTA de la page formations.html selon l'état :
   - Non connecté : tout reste en "Créer un compte" (état par défaut)
   - Standard connecté : cache "Créer un compte", montre "Passer Premium"
   - Premium : cache TOUT (les boutons "Voir le cours" suffisent) */
function adapterCtasFormations() {
  const session = lireSession()
  if (!session || !session.utilisateur) return  /* non connecté = état HTML par défaut */

  /* Connecté : on masque les 3 boutons "Créer un compte" des fiches */
  document.querySelectorAll('.cta-creer-compte').forEach(function(btn) {
    btn.style.display = 'none'
  })

  /* Bandeau bas de page : on bascule en fonction du statut */
  const ctaCreer  = document.getElementById('cta-creation-compte')
  const ctaPremium = document.getElementById('cta-passer-premium')
  if (ctaCreer)  ctaCreer.style.display = 'none'
  if (session.utilisateur.statut !== 'Premium' && ctaPremium) {
    ctaPremium.style.display = 'block'
  }
}


/* Valide le quiz et affiche le score. */
function validerQuiz(formationId, bonnesReponses) {
  let score = 0
  const total = Object.keys(bonnesReponses).length

  for (const nomQuestion in bonnesReponses) {
    const choix = document.querySelector('input[name="' + nomQuestion + '"]:checked')
    if (choix && choix.value === bonnesReponses[nomQuestion]) {
      score++
    }
  }

  const zoneResultat = document.getElementById('resultat-quiz')
  const reussi = score >= Math.ceil(total * 0.6)

  zoneResultat.classList.add('visible')
  zoneResultat.classList.toggle('succes', reussi)
  zoneResultat.classList.toggle('echec', !reussi)
  zoneResultat.textContent =
    (reussi ? '✅ Bravo ! ' : '❌ Continuez à apprendre ! ') +
    'Votre score : ' + score + '/' + total

  const boutonRecommencer = document.getElementById('bouton-recommencer')
  if (boutonRecommencer) boutonRecommencer.style.display = 'inline-block'

  const boutonValider = document.querySelector('#quiz-formation button[type="submit"]')
  if (boutonValider) boutonValider.disabled = true

  /* Mémorise le meilleur score localement (espace client) */
  const cleScore = 'score-' + formationId
  const scorePrecedent = parseInt(localStorage.getItem(cleScore) || '0', 10)
  if (score > scorePrecedent) {
    localStorage.setItem(cleScore, score)
  }
}


/* Réinitialise le quiz pour le refaire à zéro. */
function reinitialiserQuiz() {
  const formulaire = document.getElementById('quiz-formation')
  if (!formulaire) return

  formulaire.reset()

  const zoneResultat = document.getElementById('resultat-quiz')
  if (zoneResultat) {
    zoneResultat.classList.remove('visible', 'succes', 'echec')
    zoneResultat.textContent = ''
  }

  const boutonRecommencer = document.getElementById('bouton-recommencer')
  if (boutonRecommencer) boutonRecommencer.style.display = 'none'

  const boutonValider = formulaire.querySelector('button[type="submit"]')
  if (boutonValider) boutonValider.disabled = false

  formulaire.scrollIntoView({ behavior: 'smooth', block: 'start' })
}


/* ============================================================
   DASHBOARD ADMIN (admin.html)
   ============================================================ */

function formatDateCourte(isoDate) {
  if (!isoDate) return ''
  const d = new Date(isoDate)
  const jour  = String(d.getDate()).padStart(2, '0')
  const mois  = String(d.getMonth() + 1).padStart(2, '0')
  const heure = String(d.getHours()).padStart(2, '0')
  const min   = String(d.getMinutes()).padStart(2, '0')
  return jour + '/' + mois + ' ' + heure + ':' + min
}

function construireBarres(donnees, conteneurId) {
  const conteneur = document.getElementById(conteneurId)
  if (!conteneur) return

  const valeurs = Object.values(donnees)
  const max = Math.max(...valeurs, 1)

  conteneur.innerHTML = Object.keys(donnees).map(function(cle) {
    const valeur = donnees[cle]
    const pourcentage = Math.round((valeur / max) * 100)
    return (
      '<div class="admin-barre">' +
        '<span class="admin-barre-libelle">' + cle + '</span>' +
        '<div class="admin-barre-fond">' +
          '<div class="admin-barre-remplie" style="width:' + pourcentage + '%"></div>' +
        '</div>' +
        '<span class="admin-barre-valeur">' + valeur + '</span>' +
      '</div>'
    )
  }).join('')
}

function construireTableauInscriptions(lignes) {
  const conteneur = document.getElementById('table-inscriptions')
  if (!conteneur) return

  if (!lignes || lignes.length === 0) {
    conteneur.innerHTML = '<p class="admin-tableau-vide">Aucune inscription pour l\'instant.</p>'
    return
  }

  const html =
    '<table class="admin-tableau-compact">' +
      '<thead><tr>' +
        '<th>Nom</th><th>Formation</th><th>Date</th>' +
      '</tr></thead><tbody>' +
      lignes.map(function(l) {
        const nomComplet = ((l.prenom || '') + ' ' + (l.nom || '')).trim() || '—'
        return '<tr>' +
          '<td>' + nomComplet + '</td>' +
          '<td><span class="admin-badge-formation">' + (l.formation || '—') + '</span></td>' +
          '<td>' + formatDateCourte(l.date) + '</td>' +
        '</tr>'
      }).join('') +
      '</tbody></table>'

  conteneur.innerHTML = html
}

function construireTableauTransactions(lignes) {
  const conteneur = document.getElementById('table-transactions')
  if (!conteneur) return

  if (!lignes || lignes.length === 0) {
    conteneur.innerHTML = '<p class="admin-tableau-vide">Aucune transaction pour l\'instant.</p>'
    return
  }

  const html =
    '<table class="admin-tableau-compact">' +
      '<thead><tr>' +
        '<th>Référence</th><th>Email</th><th>Montant</th>' +
      '</tr></thead><tbody>' +
      lignes.map(function(l) {
        return '<tr>' +
          '<td style="font-family:monospace;font-size:0.8rem;">' + (l.reference || '—') + '</td>' +
          '<td>' + (l.email || '—') + '</td>' +
          '<td><strong>' + (l.montant || 0) + ' €</strong></td>' +
        '</tr>'
      }).join('') +
      '</tbody></table>'

  conteneur.innerHTML = html
}

function construireTableauComptes(lignes) {
  const conteneur = document.getElementById('table-comptes')
  if (!conteneur) return

  if (!lignes || lignes.length === 0) {
    conteneur.innerHTML = '<p class="admin-tableau-vide">Aucun compte pour l\'instant.</p>'
    return
  }

  const html =
    '<table class="admin-tableau-compact">' +
      '<thead><tr>' +
        '<th>Nom</th><th>Email</th><th>Statut</th><th>Créé le</th><th>Actions</th>' +
      '</tr></thead><tbody>' +
      lignes.map(function(l) {
        const nomComplet = ((l.prenom || '') + ' ' + (l.nom || '')).trim() || '—'
        const badgeClasse = l.statut === 'Premium' ? 'premium' : 'standard'
        const autreStatut = l.statut === 'Premium' ? 'Standard' : 'Premium'
        /* On échappe l'email pour pouvoir le passer en attribut HTML.
           encodeURIComponent suffit car on ne fait pas d'apostrophes. */
        const emailEchappe = encodeURIComponent(l.email)
        return '<tr>' +
          '<td>' + nomComplet + '</td>' +
          '<td>' + (l.email || '—') + '</td>' +
          '<td><span class="admin-badge-statut ' + badgeClasse + '">' + l.statut + '</span></td>' +
          '<td>' + formatDateCourte(l.date) + '</td>' +
          '<td>' +
            '<button class="admin-action" onclick="changerStatutCompte(\'' + emailEchappe + '\',\'' + autreStatut + '\')">→ ' + autreStatut + '</button>' +
            '<button class="admin-action admin-action-danger" onclick="supprimerCompteAdmin(\'' + emailEchappe + '\')">Supprimer</button>' +
          '</td>' +
        '</tr>'
      }).join('') +
      '</tbody></table>'

  conteneur.innerHTML = html
}

/* Admin : bascule le statut d'un compte (Standard ↔ Premium). */
async function changerStatutCompte(emailEncode, nouveauStatut) {
  if (!confirm('Passer ce compte en ' + nouveauStatut + ' ?')) return
  const email = decodeURIComponent(emailEncode)
  try {
    const reponse = await fetch(URL_BACKEND + '/api/admin/changer-statut.php', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body:    JSON.stringify({ email: email, nouveauStatut: nouveauStatut })
    })
    const resultat = await reponse.json()
    if (resultat.succes) {
      chargerDashboardAdmin()
    } else {
      alert(resultat.message || 'Erreur lors du changement de statut')
    }
  } catch (e) {
    alert('Impossible de contacter le serveur')
  }
}

/* Admin : supprime un compte (après confirmation). */
async function supprimerCompteAdmin(emailEncode) {
  const email = decodeURIComponent(emailEncode)
  if (!confirm('Supprimer définitivement le compte ' + email + ' ?\n\nCette action est irréversible.')) return
  try {
    const reponse = await fetch(URL_BACKEND + '/api/admin/supprimer-compte.php', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body:    JSON.stringify({ email: email })
    })
    const resultat = await reponse.json()
    if (resultat.succes) {
      chargerDashboardAdmin()
    } else {
      alert(resultat.message || 'Erreur lors de la suppression')
    }
  } catch (e) {
    alert('Impossible de contacter le serveur')
  }
}


/* ============================================================
   RESET MOT DE PASSE & VÉRIFICATION EMAIL
   ============================================================ */

/* Demande un lien de reset (email seulement, réponse générique) */
async function envoyerDemandeReset(evenement) {
  evenement.preventDefault()
  const email = document.getElementById('email-reset').value.trim()
  const zone  = document.getElementById('message-reset')
  const bouton = evenement.target.querySelector('button[type="submit"]')
  bouton.disabled = true
  bouton.textContent = 'Envoi en cours...'

  try {
    const reponse = await fetch(URL_BACKEND + '/api/mdp-demande.php', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body:    JSON.stringify({ email: email })
    })
    const resultat = await reponse.json()
    zone.className = resultat.succes ? 'message-succes' : 'message-erreur'
    zone.textContent = resultat.message
  } catch (e) {
    zone.className = 'message-erreur'
    zone.textContent = 'Impossible de contacter le serveur.'
  }
  bouton.textContent = 'Envoyer le lien'
  bouton.disabled = false
}


/* Confirme le nouveau mot de passe avec le token reçu par email */
async function envoyerConfirmationReset(evenement) {
  evenement.preventDefault()
  const nouveau    = document.getElementById('nouveau-mdp').value
  const confirme   = document.getElementById('confirmer-mdp').value
  const parametres = new URLSearchParams(window.location.search)
  const token      = parametres.get('token')
  const zone       = document.getElementById('message-reset')

  if (nouveau !== confirme) {
    zone.className = 'message-erreur'
    zone.textContent = 'Les deux mots de passe ne correspondent pas.'
    return
  }
  if (nouveau.length < 8) {
    zone.className = 'message-erreur'
    zone.textContent = 'Le mot de passe doit faire au moins 8 caractères.'
    return
  }

  const bouton = evenement.target.querySelector('button[type="submit"]')
  bouton.disabled = true
  bouton.textContent = 'Enregistrement...'

  try {
    const reponse = await fetch(URL_BACKEND + '/api/mdp-confirmer.php', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body:    JSON.stringify({ token: token, nouveauMdp: nouveau })
    })
    const resultat = await reponse.json()
    if (resultat.succes) {
      zone.className = 'message-succes'
      zone.textContent = '✓ Mot de passe modifié. Redirection vers la connexion…'
      setTimeout(function() { window.location.href = 'connexion.html' }, 1800)
    } else {
      zone.className = 'message-erreur'
      zone.textContent = resultat.message
      bouton.textContent = 'Enregistrer le nouveau mot de passe'
      bouton.disabled = false
    }
  } catch (e) {
    zone.className = 'message-erreur'
    zone.textContent = 'Impossible de contacter le serveur.'
    bouton.textContent = 'Enregistrer le nouveau mot de passe'
    bouton.disabled = false
  }
}


/* Utilisateur : supprime son propre compte (RGPD — droit à l'effacement) */
async function supprimerMonCompte() {
  if (!confirm('Êtes-vous sûr(e) de vouloir supprimer votre compte ?\n\nCette action est irréversible.')) return

  const bouton = document.getElementById('bouton-supprimer-compte')
  const message = document.getElementById('message-suppression')
  if (bouton) bouton.disabled = true
  if (message) message.innerHTML = '<p style="color: var(--couleur-texte-secondaire); margin-top: 12px;">Suppression en cours…</p>'

  try {
    const reponse = await fetch(URL_BACKEND + '/api/supprimer-compte.php', {
      method: 'POST',
      credentials: 'include'
    })
    const resultat = await reponse.json()

    if (resultat.succes) {
      if (message) message.innerHTML = '<p style="color: #2E7D32; margin-top: 12px;">✓ Compte supprimé. Redirection…</p>'
      /* Le serveur a déjà détruit la session, on vide le cache local et on redirige */
      localStorage.removeItem(CLE_SESSION)
      setTimeout(function() {
        window.location.href = 'index.html'
      }, 1500)
    } else {
      if (message) message.innerHTML = '<p style="color: #C62828; margin-top: 12px;">⚠️ ' + (resultat.message || 'Erreur') + '</p>'
      if (bouton) bouton.disabled = false
    }
  } catch (e) {
    if (message) message.innerHTML = '<p style="color: #C62828; margin-top: 12px;">⚠️ Impossible de contacter le serveur</p>'
    if (bouton) bouton.disabled = false
  }
}


/* Charge le dashboard admin et remplit le contenu.
   En cas de 401 (session expirée), on déconnecte et redirige. */
async function chargerDashboardAdmin() {
  const session = lireSession()
  const zoneMessage = document.getElementById('admin-message')
  const zoneContenu = document.getElementById('admin-contenu')

  /* Vérification rapide côté client avant l'appel API */
  if (!session || !session.utilisateur) {
    window.location.href = 'connexion.html'
    return
  }
  if (!session.utilisateur.estAdmin) {
    zoneMessage.innerHTML =
      '<div class="admin-message-erreur">⛔ Accès réservé à l\'équipe administration.</div>'
    return
  }

  zoneMessage.innerHTML = '<div class="admin-message-chargement">⏳ Chargement des statistiques…</div>'

  try {
    const reponse = await fetch(URL_BACKEND + '/api/admin/stats.php', {
      credentials: 'include'
    })

    if (reponse.status === 401) {
      /* Session expirée côté serveur : on synchronise et on déconnecte */
      localStorage.removeItem(CLE_SESSION)
      window.location.href = 'connexion.html'
      return
    }
    if (reponse.status === 403) {
      zoneMessage.innerHTML =
        '<div class="admin-message-erreur">⛔ Votre compte n\'a pas les droits admin.</div>'
      return
    }

    const resultat = await reponse.json()
    if (!resultat.succes) {
      zoneMessage.innerHTML =
        '<div class="admin-message-erreur">⚠️ ' + (resultat.message || 'Erreur inconnue') + '</div>'
      return
    }

    const s = resultat.stats

    document.getElementById('kpi-inscriptions').textContent  = s.totalInscriptions
    document.getElementById('kpi-comptes').textContent       = s.totalComptes
    document.getElementById('kpi-premium').textContent       = s.comptesParStatut.Premium
    document.getElementById('kpi-leads').textContent         = s.totalLeads
    document.getElementById('kpi-transactions').textContent  = s.totalTransactions
    document.getElementById('kpi-revenu').textContent        = s.totalRevenu + ' €'

    construireBarres(s.crmParFormation,   'repartition-formations')
    construireBarres(s.leadsParPipeline,  'repartition-pipeline')

    construireTableauInscriptions(s.dernieresInscriptions)
    construireTableauTransactions(s.dernieresTransactions)
    construireTableauComptes(s.tousLesComptes)

    zoneMessage.innerHTML = ''
    zoneContenu.style.display = 'block'

  } catch (erreur) {
    console.error('Erreur chargement dashboard :', erreur)
    zoneMessage.innerHTML =
      '<div class="admin-message-erreur">⚠️ Impossible de contacter le serveur. Vérifiez votre connexion.</div>'
  }
}


/* Initialisation au chargement de la page */
document.addEventListener('DOMContentLoaded', function() {

  /* Mise à jour de la navigation (toutes pages) */
  majNavigation()

  /* Pages formation-*.html : configure l'accès au contenu Premium */
  if (document.querySelector('.contenu-premium')) {
    configurerAccesFormation()
  }

  /* Page formations.html : adapte les CTA selon connexion / statut */
  if (document.getElementById('cta-creation-compte')) {
    adapterCtasFormations()
  }

  /* Page paiement.html */
  if (document.getElementById('conteneur-paiement')) {
    initialiserPagePaiement()
  }

  /* Page admin.html */
  if (document.getElementById('admin-contenu')) {
    chargerDashboardAdmin()
  }

  /* Page parametres.html : affiche les infos du compte + zone de danger */
  const conteneurParametres = document.getElementById('parametres-contenu')
  if (conteneurParametres) {
    const session = lireSession()
    if (!session || !session.utilisateur) {
      /* Pas connecté : on affiche le bloc d'invitation */
      const blocNonConnecte = document.getElementById('parametres-non-connecte')
      if (blocNonConnecte) blocNonConnecte.style.display = 'block'
    } else {
      /* Connecté : on remplit les infos et on active la suppression */
      const u = session.utilisateur
      document.getElementById('info-prenom').textContent = u.prenom || '—'
      document.getElementById('info-nom').textContent    = u.nom    || '—'
      document.getElementById('info-email').textContent  = u.email  || '—'

      const zoneStatut = document.getElementById('info-statut')
      const classeStatut = u.statut === 'Premium' ? 'premium' : 'standard'
      zoneStatut.innerHTML =
        '<span class="pastille-statut ' + classeStatut + '">' + u.statut + '</span>'

      conteneurParametres.style.display = 'block'

      const boutonSuppr = document.getElementById('bouton-supprimer-compte')
      if (boutonSuppr) boutonSuppr.addEventListener('click', supprimerMonCompte)
    }
  }

  /* Page reset-mot-de-passe.html : bascule demande / confirmation */
  const formDemandeReset = document.getElementById('formulaire-demande-reset')
  if (formDemandeReset) {
    const parametres = new URLSearchParams(window.location.search)
    const tokenReset = parametres.get('token')
    const formConfirmer = document.getElementById('formulaire-confirmer-reset')

    if (tokenReset) {
      formDemandeReset.style.display = 'none'
      formConfirmer.style.display = 'block'
      document.getElementById('titre-reset').textContent = 'Nouveau mot de passe'
      document.getElementById('sous-titre-reset').textContent = 'Choisissez un nouveau mot de passe (8 caractères minimum).'
      formConfirmer.addEventListener('submit', envoyerConfirmationReset)
    } else {
      formDemandeReset.addEventListener('submit', envoyerDemandeReset)
    }
  }

  /* Formulaire de connexion (connexion.html) */
  const formulaireConnexion = document.getElementById('formulaire-connexion')
  if (formulaireConnexion) {
    formulaireConnexion.addEventListener('submit', envoyerConnexion)
  }

  /* Formulaire de création de compte (inscription-compte.html) */
  const formulaireCompte = document.getElementById('formulaire-inscription-compte')
  if (formulaireCompte) {
    formulaireCompte.addEventListener('submit', envoyerCreationCompte)

    /* Pré-sélection formation depuis ?formation=IA|SCRUM|SAP */
    const parametres = new URLSearchParams(window.location.search)
    const formationPreselectionnee = parametres.get('formation')
    if (formationPreselectionnee) {
      const selectFormation = document.getElementById('formation')
      if (selectFormation) selectFormation.value = formationPreselectionnee
    }
  }

  /* Formulaire de contact (contact.html) */
  const formulaireContact = document.getElementById('form-contact')
  if (formulaireContact) {
    formulaireContact.addEventListener('submit', envoyeContact)
  }

  /* Menu mobile (toutes pages) */
  const boutonMenu = document.querySelector('.menu-mobile')
  if (boutonMenu) {
    boutonMenu.addEventListener('click', gereMenuMobile)
  }

})
