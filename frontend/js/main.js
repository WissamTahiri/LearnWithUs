/* main.js — JavaScript principal de LearnWithUs
   Chargé sur toutes les pages. Gère : menu mobile, formulaires,
   onglets espace client, accordéon FAQ, authentification. */

/* URL du backend — changer ici pour basculer entre dev et prod */
const URL_BACKEND = 'https://learnwithus-backend.onrender.com'

/* Clé de stockage localStorage pour la session utilisateur */
const CLE_SESSION = 'learnwithus_session'


/* ===== SESSION UTILISATEUR ===== */
/* La session (token JWT + infos) est stockée dans localStorage
   pour persister entre les pages et les rechargements. */

/* Lit la session active. Retourne null si aucun utilisateur connecté. */
function lireSession() {
  const donnees = localStorage.getItem(CLE_SESSION)
  if (!donnees) return null
  try {
    return JSON.parse(donnees)
  } catch (e) {
    return null
  }
}

/* Enregistre le jeton et les infos utilisateur après connexion/inscription */
function sauverSession(token, utilisateur) {
  localStorage.setItem(CLE_SESSION, JSON.stringify({ token, utilisateur }))
}

/* Déconnecte l'utilisateur et le renvoie sur l'accueil */
function deconnecter() {
  localStorage.removeItem(CLE_SESSION)
  window.location.href = 'index.html'
}

/* Met à jour la navigation selon l'état de connexion :
   - non connecté : lien "Connexion" visible
   - connecté : "Bonjour Prénom" + "Déconnexion" */
function majNavigation() {
  const session = lireSession()
  const liensNav = document.querySelector('.nav-liens')
  if (!liensNav) return

  const lienConnexion = liensNav.querySelector('a[href="connexion.html"]')

  if (session && session.utilisateur && lienConnexion) {
    const parent = lienConnexion.parentElement
    parent.innerHTML =
      '<a href="espace-client.html">Bonjour ' + session.utilisateur.prenom + '</a>'

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


/* Envoie les données du formulaire d'inscription au backend */
async function envoyeInscription(evenement) {
  evenement.preventDefault()

  const donneesInscription = {
    prenom:    document.getElementById('prenom').value,
    nom:       document.getElementById('nom').value,
    email:     document.getElementById('email').value,
    formation: document.getElementById('formation').value,
    telephone: document.getElementById('telephone').value
  }

  /* Désactive le bouton pendant l'envoi pour éviter les doublons */
  const boutonEnvoi = evenement.target.querySelector('button[type="submit"]')
  const texteOriginal = boutonEnvoi.textContent
  boutonEnvoi.disabled = true
  boutonEnvoi.textContent = 'Envoi en cours...'

  try {
    const reponse = await fetch(URL_BACKEND + '/api/inscription', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(donneesInscription)
    })

    const resultat = await reponse.json()
    const zoneMessage = document.getElementById('message-inscription')

    if (resultat.succes) {
      zoneMessage.className = 'message-succes'
      zoneMessage.textContent =
        'Merci ' + donneesInscription.prenom + ' ! ' +
        'Votre inscription a bien été reçue. ' +
        'Un email de confirmation vous a été envoyé.'
      document.getElementById('form-inscription').reset()
    } else {
      zoneMessage.className = 'message-erreur'
      zoneMessage.textContent =
        resultat.message || 'Une erreur est survenue. Veuillez réessayer.'
    }

  } catch (erreur) {
    console.error('Erreur lors de l\'inscription :', erreur)
    const zoneMessage = document.getElementById('message-inscription')
    zoneMessage.className = 'message-erreur'
    zoneMessage.textContent =
      'Impossible de contacter le serveur. Vérifiez votre connexion et réessayez.'
  }

  boutonEnvoi.disabled = false
  boutonEnvoi.textContent = texteOriginal
}


/* Envoie les données du formulaire de contact au backend */
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
    const reponse = await fetch(URL_BACKEND + '/api/contact', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(donneesContact)
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


/* Affiche un message temporaire pour le bouton d'abonnement Premium */
function afficherMessageAbonnement() {
  const zoneMessage = document.getElementById('message-abonnement')
  zoneMessage.className = 'message-succes'
  zoneMessage.innerHTML =
    'Intégration Stripe en cours de développement. ' +
    'Contactez-nous sur la page ' +
    '<a href="contact.html">Contact</a> pour un accès anticipé.'
}


/* ===== AUTHENTIFICATION ===== */
/* Envoie le formulaire de création de compte au backend */
async function envoyerCreationCompte(evenement) {
  evenement.preventDefault()

  const prenom           = document.getElementById('prenom').value.trim()
  const nom              = document.getElementById('nom').value.trim()
  const email            = document.getElementById('email').value.trim()
  const motDePasse       = document.getElementById('mot-de-passe').value
  const confirmationMdp  = document.getElementById('confirmation-mdp').value
  const cguAcceptees     = document.getElementById('cgu').checked

  const zoneMessage = document.getElementById('message-auth')

  /* Vérifications côté client avant d'envoyer au backend */
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
    const reponse = await fetch(URL_BACKEND + '/api/creer-compte', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prenom, nom, email, motDePasse })
    })
    const resultat = await reponse.json()

    if (resultat.succes) {
      /* Compte créé : on stocke la session et on redirige */
      sauverSession(resultat.token, resultat.utilisateur)
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


/* Envoie le formulaire de connexion au backend */
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
    const reponse = await fetch(URL_BACKEND + '/api/connexion', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, motDePasse })
    })
    const resultat = await reponse.json()

    if (resultat.succes) {
      sauverSession(resultat.token, resultat.utilisateur)
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


/* Affiche un message sous les cartes de formation de l'espace client */
function afficherMessageFormation(typeOffre) {
  const zoneMessage = document.getElementById('message-formation-' + typeOffre)
  if (!zoneMessage) return

  if (typeOffre === 'standard') {
    zoneMessage.textContent =
      'Les contenus vidéo gratuits seront disponibles très prochainement. ' +
      'Vous recevrez un email dès leur mise en ligne.'
  } else {
    zoneMessage.textContent =
      'Cet accès est réservé aux abonnés Premium. ' +
      'Souscrivez à l\'offre Premium ci-dessous pour accéder au contenu complet en HD.'
  }

  zoneMessage.classList.add('visible')
}


/* Initialisation au chargement de la page */
document.addEventListener('DOMContentLoaded', function() {

  /* Mise à jour de la navigation selon l'état de connexion (toutes pages) */
  majNavigation()

  /* Formulaire de connexion — présent uniquement sur connexion.html */
  const formulaireConnexion = document.getElementById('formulaire-connexion')
  if (formulaireConnexion) {
    formulaireConnexion.addEventListener('submit', envoyerConnexion)
  }

  /* Formulaire de création de compte — présent sur inscription-compte.html */
  const formulaireCompte = document.getElementById('formulaire-inscription-compte')
  if (formulaireCompte) {
    formulaireCompte.addEventListener('submit', envoyerCreationCompte)
  }

  /* Formulaire d'inscription — présent uniquement sur formations.html */
  const formulaireInscription = document.getElementById('form-inscription')
  if (formulaireInscription) {
    formulaireInscription.addEventListener('submit', envoyeInscription)
  }

  /* Formulaire de contact — présent uniquement sur contact.html */
  const formulaireContact = document.getElementById('form-contact')
  if (formulaireContact) {
    formulaireContact.addEventListener('submit', envoyeContact)
  }

  /* Menu mobile — présent sur toutes les pages */
  const boutonMenu = document.querySelector('.menu-mobile')
  if (boutonMenu) {
    boutonMenu.addEventListener('click', gereMenuMobile)
  }

  /* Boutons "S'inscrire" — font défiler vers le formulaire
     et pré-sélectionnent la formation via data-formation */
  const boutonsInscription = document.querySelectorAll('.bouton-inscription')
  boutonsInscription.forEach(function(bouton) {
    bouton.addEventListener('click', function() {
      const formationChoisie = bouton.dataset.formation
      const selectFormation = document.getElementById('formation')
      if (selectFormation && formationChoisie) {
        selectFormation.value = formationChoisie
      }
      const sectionFormulaire = document.getElementById('formulaire-inscription')
      if (sectionFormulaire) {
        sectionFormulaire.scrollIntoView({ behavior: 'smooth' })
      }
    })
  })

})
