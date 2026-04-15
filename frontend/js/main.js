/* main.js — JavaScript principal de LearnWithUs
   Chargé sur toutes les pages. Gère : menu mobile, formulaires,
   onglets espace client, accordéon FAQ. */

/* URL du backend — changer ici pour basculer entre dev et prod */
const URL_BACKEND = 'https://learnwithus-backend.onrender.com'


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


/* Initialisation au chargement de la page */
document.addEventListener('DOMContentLoaded', function() {

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
