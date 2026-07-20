/* main.js — JavaScript principal de LearnWithUs
   Chargé sur toutes les pages. Gère : menu mobile, formulaires,
   onglets espace client, accordéon FAQ, authentification.

   Backend : fonctions serverless Node.js (Vercel), sous /api/.
   Authentification : cookie de session signé (HMAC), envoyé
   automatiquement par le navigateur (credentials:'include'). */


/* URL du backend — préfixe ajouté à chaque appel fetch.
   Le backend est desormais une fonction serverless Node.js servie
   sous /api/ du meme domaine que le frontend (Vercel) : pas de
   prefixe separe, pas de CORS a gerer. */
const URL_BACKEND = ''

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
    await fetch(URL_BACKEND + '/api/deconnexion', {
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
/* Neutralise le HTML d'une valeur avant injection via innerHTML : prenom, nom,
   email, formation... proviennent du serveur, on evite toute injection de balise. */
function echappeHtml(valeur) {
  return String(valeur == null ? '' : valeur)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}


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
        echappeHtml(session.utilisateur.prenom) +
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
  const ouvert = liensNavigation.classList.toggle('menu-ouvert')
  const bouton = document.querySelector('.menu-mobile')
  if (bouton) {
    bouton.setAttribute('aria-expanded', ouvert ? 'true' : 'false')
    bouton.setAttribute('aria-label', ouvert ? 'Fermer le menu' : 'Ouvrir le menu')
  }
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
    const reponse = await fetch(URL_BACKEND + '/api/contact', {
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
  if (motDePasse.length < 8 || !/[A-Z]/.test(motDePasse) || !/[0-9]/.test(motDePasse)) {
    zoneMessage.className = 'message-erreur'
    zoneMessage.textContent = 'Le mot de passe doit faire au moins 8 caractères, avec une majuscule et un chiffre.'
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
    const reponse = await fetch(URL_BACKEND + '/api/connexion', {
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
    cvv.value = cvv.value.replace(/\D/g, '').slice(0, 3)
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
    const reponse = await fetch(URL_BACKEND + '/api/activer-premium', {
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
      /* la page SCRUM est en anglais (lang="en") : on garde le CTA dans la
         langue de la page au lieu d'injecter systematiquement du francais. */
      const en = document.documentElement.lang === 'en'
      if (estConnecte) {
        message.textContent = en
          ? 'Upgrade to Premium to unlock the full course, the complete video and the final quiz.'
          : 'Passez à Premium pour débloquer le cours complet, la vidéo complète et le quiz final.'
        bouton.textContent = en ? 'Go Premium' : 'Passer à Premium'
        bouton.href = 'paiement.html'
      } else {
        message.textContent = en
          ? 'Create your free account to get started, then go Premium to unlock everything.'
          : 'Créez votre compte gratuit pour commencer, puis passez Premium pour tout débloquer.'
        bouton.textContent = en ? 'Create an account' : 'Créer un compte'
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
        '<th>Nom</th><th>Email</th><th>Date</th>' +
      '</tr></thead><tbody>' +
      lignes.map(function(l) {
        const nomComplet = ((l.prenom || '') + ' ' + (l.nom || '')).trim() || '—'
        return '<tr>' +
          '<td>' + echappeHtml(nomComplet) + '</td>' +
          '<td>' + echappeHtml(l.email || '—') + '</td>' +
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
          '<td style="font-family:monospace;font-size:0.8rem;">' + echappeHtml(l.reference || '—') + '</td>' +
          '<td>' + echappeHtml(l.email || '—') + '</td>' +
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
        /* L'email part en attribut data- ÉCHAPPÉ (echappeHtml protège le
           contexte HTML). On ne le met plus dans un onclick : une apostrophe
           dans l'email (valide RFC) cassait la chaîne JS → XSS stockée. */
        const emailAttr = echappeHtml(l.email || '')
        return '<tr>' +
          '<td>' + echappeHtml(nomComplet) + '</td>' +
          '<td>' + echappeHtml(l.email || '—') + '</td>' +
          '<td><span class="admin-badge-statut ' + badgeClasse + '">' + echappeHtml(l.statut) + '</span></td>' +
          '<td>' + formatDateCourte(l.date) + '</td>' +
          '<td>' +
            '<button class="admin-action" data-action="statut" data-email="' + emailAttr + '" data-statut="' + autreStatut + '">→ ' + autreStatut + '</button>' +
            '<button class="admin-action admin-action-danger" data-action="supprimer" data-email="' + emailAttr + '">Supprimer</button>' +
          '</td>' +
        '</tr>'
      }).join('') +
      '</tbody></table>'

  conteneur.innerHTML = html

  /* Délégation : on lit l'email depuis dataset (déjà décodé par le navigateur,
     jamais réinjecté dans du HTML) → aucune surface d'injection. */
  conteneur.querySelectorAll('button[data-action]').forEach(function(btn) {
    btn.addEventListener('click', function() {
      const email = btn.dataset.email
      if (btn.dataset.action === 'statut') {
        changerStatutCompte(email, btn.dataset.statut)
      } else {
        supprimerCompteAdmin(email)
      }
    })
  })
}

/* Admin : bascule le statut d'un compte (Standard ↔ Premium). */
async function changerStatutCompte(email, nouveauStatut) {
  if (!confirm('Passer ce compte en ' + nouveauStatut + ' ?')) return
  try {
    const reponse = await fetch(URL_BACKEND + '/api/admin/changer-statut', {
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
async function supprimerCompteAdmin(email) {
  if (!confirm('Supprimer définitivement le compte ' + email + ' ?\n\nCette action est irréversible.')) return
  try {
    const reponse = await fetch(URL_BACKEND + '/api/admin/supprimer-compte', {
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
    const reponse = await fetch(URL_BACKEND + '/api/mdp-demande', {
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
  if (nouveau.length < 8 || !/[A-Z]/.test(nouveau) || !/[0-9]/.test(nouveau)) {
    zone.className = 'message-erreur'
    zone.textContent = 'Le mot de passe doit faire au moins 8 caractères, avec une majuscule et un chiffre.'
    return
  }

  const bouton = evenement.target.querySelector('button[type="submit"]')
  bouton.disabled = true
  bouton.textContent = 'Enregistrement...'

  try {
    const reponse = await fetch(URL_BACKEND + '/api/mdp-confirmer', {
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
    const reponse = await fetch(URL_BACKEND + '/api/supprimer-compte', {
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
    const reponse = await fetch(URL_BACKEND + '/api/admin/stats', {
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
/* =============================================================
   Lecteurs vidéo des cours (pages formation-*.html)
   La vidéo est servie depuis Vercel Blob Storage (URL absolue dans
   le <source>, cross-origin, pas de dossier local frontend/videos/).
   Tant que le fichier n'est pas en ligne (404), on masque le lecteur
   et on affiche un repli "bientôt disponible". */
function initLecteursVideo() {
  document.querySelectorAll('.video-cours').forEach(function(video) {
    const conteneur = video.closest('.video-cours-conteneur')
    if (!conteneur) return
    const repli = conteneur.querySelector('.video-indisponible')
    function afficherRepli() {
      video.hidden = true
      if (repli) repli.hidden = false
    }
    /* erreur sur la source (fichier absent) ou sur le lecteur lui-même */
    const source = video.querySelector('source')
    if (source) source.addEventListener('error', afficherRepli)
    video.addEventListener('error', afficherRepli)
  })
}

document.addEventListener('DOMContentLoaded', function() {

  /* Mise à jour de la navigation (toutes pages) */
  majNavigation()

  /* Pages formation-*.html : configure l'accès au contenu Premium */
  if (document.querySelector('.contenu-premium')) {
    configurerAccesFormation()
  }

  /* Pages formation-*.html : lecteurs vidéo (repli si pas encore en ligne) */
  initLecteursVideo()

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

  /* Page espace-client.html : ouvre directement l'onglet Premium si l'URL le
     demande (#premium ou ?onglet=premium) - le recu de paiement y renvoie. */
  if (document.getElementById('contenu-premium') &&
      (window.location.hash === '#premium' ||
       new URLSearchParams(window.location.search).get('onglet') === 'premium')) {
    basculerOnglet('premium')
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

  /* ===== Améliorations frontend Phase 6 ===== */
  injecterBoutonTheme()          /* bascule thème clair/sombre (toutes pages) */
  injecterBoutonHaut()           /* bouton retour en haut (toutes pages) */
  injecterBarreProgression()     /* barre de progression (pages formation) */
  if (document.querySelector('.formation-contenu')) {
    initEstimationFormation()    /* estimation du temps (pages formation) */
  }
  /* Jauge de force du mot de passe : inscription (#mot-de-passe) et
     réinitialisation (#nouveau-mdp). Ne fait rien si la jauge est absente. */
  initJaugeMotDePasse(document.getElementById('mot-de-passe'), document.getElementById('jauge-mdp'))
  initJaugeMotDePasse(document.getElementById('nouveau-mdp'), document.getElementById('jauge-mdp-reset'))
  activerAffichageMotDePasse()  /* œil afficher/masquer sur les champs mot de passe */

})


/* ============================================================
   AMÉLIORATIONS FRONTEND (Phase 6)
   Six briques 100 % frontend : thème sombre, barre de progression
   de lecture, bouton retour en haut, fil d'Ariane (statique HTML),
   estimation du temps de formation, jauge de force du mot de passe.
   Les fonctions sont appelées depuis le bloc DOMContentLoaded plus haut.
   ============================================================ */


/* ----- 1. THÈME SOMBRE ----- */

/* Applique le thème mémorisé le plus tôt possible (limite le flash au chargement). */
;(function appliquerThemeInitial() {
  try {
    if (localStorage.getItem('learnwithus_theme') === 'sombre') {
      document.documentElement.setAttribute('data-theme', 'sombre')
    }
  } catch (e) {}
})()

function themeEstSombre() {
  return document.documentElement.getAttribute('data-theme') === 'sombre'
}

/* Bouton de bascule 🌙/☀️ inséré dans la navbar (collé à droite). */
function injecterBoutonTheme() {
  const navContenu = document.querySelector('.nav-contenu')
  if (!navContenu || navContenu.querySelector('.bascule-theme')) return

  const bouton = document.createElement('button')
  bouton.type = 'button'
  bouton.className = 'bascule-theme'
  bouton.setAttribute('aria-label', 'Changer de thème clair ou sombre')

  const ICONE_LUNE = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>'
  const ICONE_SOLEIL = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="4.5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>'
  function majApparence() {
    const sombre = themeEstSombre()
    bouton.innerHTML = sombre ? ICONE_SOLEIL : ICONE_LUNE
    bouton.title = sombre ? 'Passer en thème clair' : 'Passer en thème sombre'
  }

  bouton.addEventListener('click', function() {
    if (themeEstSombre()) {
      document.documentElement.removeAttribute('data-theme')
      try { localStorage.setItem('learnwithus_theme', 'clair') } catch (e) {}
    } else {
      document.documentElement.setAttribute('data-theme', 'sombre')
      try { localStorage.setItem('learnwithus_theme', 'sombre') } catch (e) {}
    }
    majApparence()
  })

  majApparence()
  // Regroupe le toggle à droite, juste avant la zone "compte" (lien Connexion
  // ou pastille prénom), pour une barre de navigation plus nette.
  const liensNav = navContenu.querySelector('.nav-liens')
  const liTheme = document.createElement('li')
  liTheme.className = 'nav-theme'
  liTheme.appendChild(bouton)
  const ancreCompte = liensNav.querySelector('a[href="connexion.html"], a.badge-utilisateur')
  const liCompte = ancreCompte ? ancreCompte.closest('li') : null
  if (liCompte) liensNav.insertBefore(liTheme, liCompte)
  else liensNav.appendChild(liTheme)
}


/* ----- 2. BARRE DE PROGRESSION DE LECTURE (pages formation) ----- */
function injecterBarreProgression() {
  if (!document.querySelector('.formation-contenu')) return

  const barre = document.createElement('div')
  barre.className = 'barre-progression-lecture'
  document.body.appendChild(barre)

  function maj() {
    const doc = document.documentElement
    const hauteurDefilable = doc.scrollHeight - doc.clientHeight
    const ratio = hauteurDefilable > 0 ? (doc.scrollTop / hauteurDefilable) : 0
    barre.style.width = (ratio * 100) + '%'
  }
  window.addEventListener('scroll', maj, { passive: true })
  window.addEventListener('resize', maj)
  maj()
}


/* ----- 3. BOUTON "RETOUR EN HAUT" ----- */
function injecterBoutonHaut() {
  const bouton = document.createElement('button')
  bouton.type = 'button'
  bouton.className = 'bouton-haut'
  bouton.setAttribute('aria-label', 'Revenir en haut de la page')
  bouton.textContent = '↑'
  bouton.addEventListener('click', function() {
    window.scrollTo({ top: 0, behavior: 'smooth' })
  })
  document.body.appendChild(bouton)

  function majVisibilite() {
    bouton.classList.toggle('visible', window.scrollY > 300)
  }
  window.addEventListener('scroll', majVisibilite, { passive: true })
  majVisibilite()
}


/* ----- 5. ESTIMATION DU TEMPS DE FORMATION -----
   temps = lecture du texte (200 mots/min) + durée vidéo (vraie durée si
   connue, sinon repli data-duree-min) + lecture des ressources jointes
   (somme des data-lecture-min). */
function initEstimationFormation() {
  const contenu = document.querySelector('.formation-contenu')
  if (!contenu) return

  const MOTS_PAR_MINUTE = 200

  // 1) Mots du texte (intro + cours + quiz), hors bloc Ressources.
  let mots = 0
  contenu.querySelectorAll('.formation-bloc').forEach(function(bloc) {
    if (bloc.classList.contains('bloc-ressources')) return
    const texte = (bloc.innerText || bloc.textContent || '').trim()
    if (texte) mots += texte.split(/\s+/).length
  })
  const minutesTexte = Math.max(1, Math.round(mots / MOTS_PAR_MINUTE))

  const video = contenu.querySelector('.video-cours')

  function minutesVideo() {
    if (video && !isNaN(video.duration) && video.duration > 0) {
      return Math.round(video.duration / 60)
    }
    if (video && video.dataset.dureeMin) {
      return parseInt(video.dataset.dureeMin, 10) || 0
    }
    return 0
  }

  function minutesRessources() {
    let total = 0
    contenu.querySelectorAll('.liste-ressources [data-lecture-min]').forEach(function(el) {
      total += parseInt(el.dataset.lectureMin, 10) || 0
    })
    return total
  }

  const bloc = document.createElement('div')
  bloc.className = 'formation-estimation'
  contenu.insertBefore(bloc, contenu.firstChild)

  function rendre() {
    const mv = minutesVideo()
    const mr = minutesRessources()
    const total = minutesTexte + mv + mr
    bloc.innerHTML =
      '<span class="formation-estimation-icone">⏱️</span>' +
      '<span class="formation-estimation-total">Formation complète : ~' + total + ' min</span>' +
      '<span class="formation-estimation-detail">' +
        'lecture ' + minutesTexte + ' min · vidéo ' + mv + ' min · ressources ' + mr + ' min' +
      '</span>'
  }

  rendre()
  // La vraie durée n'est connue qu'au chargement des métadonnées de la vidéo.
  if (video) video.addEventListener('loadedmetadata', rendre)
}


/* ----- 6. JAUGE DE FORCE DU MOT DE PASSE ----- */

/* Score 0 à 5 : +1 par critère (≥8, ≥12, majuscule, chiffre, caractère spécial).
   Indicatif : la règle qui fait foi est vérifiée côté serveur PHP. */
function evaluerForceMotDePasse(mdp) {
  let score = 0
  if (mdp.length >= 8) score++
  if (mdp.length >= 12) score++
  if (/[A-Z]/.test(mdp)) score++
  if (/[0-9]/.test(mdp)) score++
  if (/[^A-Za-z0-9]/.test(mdp)) score++
  return score
}

function initJaugeMotDePasse(champ, jauge) {
  if (!champ || !jauge) return
  const libelle = jauge.querySelector('.jauge-mdp-libelle')

  champ.addEventListener('input', function() {
    const mdp = champ.value
    if (!mdp) {
      jauge.removeAttribute('data-niveau')
      if (libelle) libelle.textContent = ''
      return
    }
    const score = evaluerForceMotDePasse(mdp)
    let niveau, texte
    if (score <= 2)       { niveau = 'faible';    texte = 'Mot de passe faible' }
    else if (score === 3) { niveau = 'moyen';     texte = 'Mot de passe moyen' }
    else if (score === 4) { niveau = 'fort';      texte = 'Mot de passe fort' }
    else                  { niveau = 'tres-fort'; texte = 'Mot de passe très fort' }
    jauge.setAttribute('data-niveau', niveau)
    if (libelle) libelle.textContent = texte
  })
}


/* ============================================================
   AFFICHAGE DU MOT DE PASSE (œil afficher/masquer)
   ------------------------------------------------------------
   Amélioration progressive : enveloppe chaque champ mot de passe
   dans un conteneur positionné et y ajoute un bouton "œil" qui
   bascule le type entre "password" et "text". S'applique à la
   connexion, la création de compte et la réinitialisation.
   Sans JS, le champ reste un mot de passe masqué classique.
   ============================================================ */

var ICONE_OEIL = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z"/><circle cx="12" cy="12" r="3"/></svg>'
var ICONE_OEIL_BARRE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>'

function activerAffichageMotDePasse() {
  var champs = document.querySelectorAll('input[type="password"]')
  champs.forEach(function(champ) {
    if (champ.dataset.oeilActif) return          /* évite le double montage */
    champ.dataset.oeilActif = '1'

    /* Enveloppe le champ pour positionner le bouton par-dessus */
    var conteneur = document.createElement('span')
    conteneur.className = 'champ-mdp'
    champ.parentNode.insertBefore(conteneur, champ)
    conteneur.appendChild(champ)
    champ.style.paddingRight = '44px'            /* laisse la place à l'œil */

    var bouton = document.createElement('button')
    bouton.type = 'button'                       /* n'envoie pas le formulaire */
    bouton.className = 'bouton-oeil'
    bouton.setAttribute('aria-label', 'Afficher le mot de passe')
    bouton.setAttribute('aria-pressed', 'false')
    bouton.innerHTML = ICONE_OEIL

    bouton.addEventListener('click', function() {
      var visible = champ.type === 'text'
      champ.type = visible ? 'password' : 'text'
      bouton.setAttribute('aria-pressed', visible ? 'false' : 'true')
      bouton.setAttribute('aria-label', visible ? 'Afficher le mot de passe' : 'Masquer le mot de passe')
      bouton.innerHTML = visible ? ICONE_OEIL : ICONE_OEIL_BARRE
    })

    conteneur.appendChild(bouton)
  })
}
