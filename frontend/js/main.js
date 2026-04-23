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
   - connecté : pastille colorée avec le prénom + lien "Déconnexion" */
function majNavigation() {
  const session = lireSession()
  const liensNav = document.querySelector('.nav-liens')
  if (!liensNav) return

  const lienConnexion = liensNav.querySelector('a[href="connexion.html"]')

  if (session && session.utilisateur && lienConnexion) {
    /* Remplace "Connexion" par une pastille cliquable qui mène
       à l'espace client. La classe .badge-utilisateur est stylée
       dans style.css (fond bordeaux, texte blanc, coins arrondis). */
    const parent = lienConnexion.parentElement
    parent.innerHTML =
      '<a href="espace-client.html" class="badge-utilisateur">' +
        session.utilisateur.prenom +
      '</a>'

    /* Si l'utilisateur est admin, on insère un lien vers le dashboard
       (visible uniquement pour les emails listés dans ADMIN_EMAILS côté backend). */
    if (session.utilisateur.estAdmin) {
      const liAdmin = document.createElement('li')
      liAdmin.innerHTML =
        '<a href="admin.html" class="lien-admin">🔐 Admin</a>'
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


/* ===== AUTHENTIFICATION ===== */
/* Envoie le formulaire de création de compte au backend */
async function envoyerCreationCompte(evenement) {
  evenement.preventDefault()

  const prenom           = document.getElementById('prenom').value.trim()
  const nom              = document.getElementById('nom').value.trim()
  const email            = document.getElementById('email').value.trim()
  const telephone        = document.getElementById('telephone').value.trim()
  const formation        = document.getElementById('formation').value
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
      body: JSON.stringify({ prenom, nom, email, telephone, formation, motDePasse })
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


/* ===== PAGE DE PAIEMENT ===== */
/* Initialise la page paiement.html selon l'état de l'utilisateur :
   - non connecté : invitation à créer un compte / se connecter
   - déjà Premium : rien à faire, message + lien vers l'espace client
   - Standard connecté : affiche le formulaire de carte */
function initialiserPagePaiement() {
  const vueFormulaire = document.getElementById('vue-formulaire')
  const conteneur     = document.getElementById('conteneur-paiement')
  if (!vueFormulaire || !conteneur) return

  const session = lireSession()

  /* Cas 1 : utilisateur non connecté */
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

  /* Cas 2 : utilisateur déjà Premium */
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

  /* Cas 3 : Standard connecté — on active le formatage auto des champs
     et on branche la soumission du formulaire au backend */
  brancherFormatsCarte()
  document.getElementById('formulaire-paiement')
    .addEventListener('submit', envoyerPaiement)
}

/* Formate les champs de la carte à la volée (espaces tous les 4 chiffres,
   slash automatique dans MM/AA, restriction aux chiffres pour CVV) */
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

/* Envoie la demande d'activation Premium au backend.
   Les données de la carte ne sont PAS transmises — aucun vrai paiement.
   Seul le jeton JWT sert à identifier l'utilisateur côté serveur. */
async function envoyerPaiement(evenement) {
  evenement.preventDefault()

  const zoneMessage = document.getElementById('message-paiement')
  const bouton      = evenement.target.querySelector('button[type="submit"]')
  const texteInitial = bouton.textContent

  /* Vérifications visuelles côté client (format des champs) */
  const numero = document.getElementById('numero-carte').value.replace(/\s/g, '')
  const expi   = document.getElementById('expiration').value
  const cvv    = document.getElementById('cvv').value
  const nom    = document.getElementById('nom-carte').value.trim()

  if (nom.length < 2 || numero.length < 13 || !/^\d\d\/\d\d$/.test(expi) || cvv.length < 3) {
    zoneMessage.className = 'message-erreur'
    zoneMessage.textContent = 'Merci de vérifier les informations de la carte.'
    return
  }

  const session = lireSession()
  if (!session) {
    window.location.href = 'connexion.html'
    return
  }

  bouton.disabled = true
  bouton.textContent = 'Paiement en cours...'

  try {
    const reponse = await fetch(URL_BACKEND + '/api/activer-premium', {
      method: 'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': 'Bearer ' + session.token
      }
    })
    const resultat = await reponse.json()

    if (resultat.succes) {
      /* Remplace la session locale par la nouvelle (statut = Premium) */
      sauverSession(resultat.token, resultat.utilisateur)
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


/* ===== PAGES DE FORMATION ===== */
/* Gère l'accès au contenu Premium sur les pages formation-*.html
   - Non connecté : sections Premium floutées + CTA "Créer un compte"
   - Standard : sections Premium floutées + CTA "Passer Premium"
   - Premium : tout débloqué */
function configurerAccesFormation() {
  const session = lireSession()
  const estConnecte = !!(session && session.utilisateur)
  const estPremium  = estConnecte && session.utilisateur.statut === 'Premium'

  const sectionsPremium = document.querySelectorAll('.contenu-premium')
  const carteCta        = document.getElementById('cta-premium')

  if (estPremium) {
    /* Accès complet : on retire le flou et on cache la carte CTA */
    sectionsPremium.forEach(function(s) { s.classList.remove('contenu-bloque') })
    if (carteCta) carteCta.style.display = 'none'
  } else {
    /* Accès restreint : on floute et on adapte le message CTA */
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

/* Valide le quiz d'une page formation et affiche le score.
   - formationId : identifiant court (ia, scrum, sap) pour stocker le score
   - bonnesReponses : objet { q1: 'b', q2: 'a', ... } */
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
  const reussi = score >= Math.ceil(total * 0.6)   /* 60% pour réussir */

  zoneResultat.classList.add('visible')
  zoneResultat.classList.toggle('succes', reussi)
  zoneResultat.classList.toggle('echec', !reussi)
  zoneResultat.textContent =
    (reussi ? '✅ Bravo ! ' : '❌ Continuez à apprendre ! ') +
    'Votre score : ' + score + '/' + total

  /* Affiche le bouton "Recommencer" pour refaire le quiz à zéro */
  const boutonRecommencer = document.getElementById('bouton-recommencer')
  if (boutonRecommencer) boutonRecommencer.style.display = 'inline-block'

  /* Désactive le bouton "Valider" tant qu'on n'a pas recommencé */
  const boutonValider = document.querySelector('#quiz-formation button[type="submit"]')
  if (boutonValider) boutonValider.disabled = true

  /* Mémorise le meilleur score localement pour l'afficher dans l'espace client */
  const cleScore = 'score-' + formationId
  const scorePrecedent = parseInt(localStorage.getItem(cleScore) || '0', 10)
  if (score > scorePrecedent) {
    localStorage.setItem(cleScore, score)
  }
}

/* Réinitialise le quiz : décoche toutes les réponses, cache le résultat
   et réactive la soumission du formulaire. */
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

/* Formate une date ISO en "JJ/MM HH:MM" pour les tableaux du dashboard */
function formatDateCourte(isoDate) {
  if (!isoDate) return ''
  const d = new Date(isoDate)
  const jour  = String(d.getDate()).padStart(2, '0')
  const mois  = String(d.getMonth() + 1).padStart(2, '0')
  const heure = String(d.getHours()).padStart(2, '0')
  const min   = String(d.getMinutes()).padStart(2, '0')
  return jour + '/' + mois + ' ' + heure + ':' + min
}

/* Construit une barre de répartition pour un objet { clé: valeur } */
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

/* Construit le tableau HTML des dernières inscriptions */
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

/* Construit le tableau HTML des dernières transactions */
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

/* Construit le tableau HTML de gestion des comptes (admin) */
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

/* Admin : bascule le statut d'un compte (Standard ↔ Premium) */
async function changerStatutCompte(emailEncode, nouveauStatut) {
  if (!confirm('Passer ce compte en ' + nouveauStatut + ' ?')) return
  const session = lireSession()
  try {
    const reponse = await fetch(URL_BACKEND + '/api/admin/comptes/' + emailEncode + '/statut', {
      method:  'PUT',
      headers: {
        'Authorization': 'Bearer ' + session.token,
        'Content-Type':  'application/json'
      },
      body: JSON.stringify({ nouveauStatut: nouveauStatut })
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

/* Admin : supprime un compte (après confirmation) */
async function supprimerCompteAdmin(emailEncode) {
  const emailLisible = decodeURIComponent(emailEncode)
  if (!confirm('Supprimer définitivement le compte ' + emailLisible + ' ?\n\nCette action est irréversible.')) return
  const session = lireSession()
  try {
    const reponse = await fetch(URL_BACKEND + '/api/admin/comptes/' + emailEncode, {
      method:  'DELETE',
      headers: { 'Authorization': 'Bearer ' + session.token }
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
   RESET MOT DE PASSE & VÉRIFICATION EMAIL (Lot 3 — sécurité)
   ============================================================ */

/* Envoie la demande de reset (email seulement — le backend ne révèle
   jamais si l'email existe pour éviter l'énumération) */
async function envoyerDemandeReset(evenement) {
  evenement.preventDefault()
  const email = document.getElementById('email-reset').value.trim()
  const zone  = document.getElementById('message-reset')
  const bouton = evenement.target.querySelector('button[type="submit"]')
  bouton.disabled = true
  bouton.textContent = 'Envoi en cours...'

  try {
    const reponse = await fetch(URL_BACKEND + '/api/mdp/demande', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
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

/* Confirme le nouveau mot de passe (JWT reset dans l'URL ?token=...) */
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
    const reponse = await fetch(URL_BACKEND + '/api/mdp/confirmer', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
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

/* Appelle /api/verifier-email au chargement de la page verification-email.html */
async function traiterVerificationEmail() {
  const parametres = new URLSearchParams(window.location.search)
  const token      = parametres.get('token')
  const carte      = document.getElementById('carte-verif')

  if (!token) {
    carte.innerHTML =
      '<div class="icone-resultat">⚠️</div>' +
      '<h1 class="titre-resultat">Lien incomplet</h1>' +
      '<p class="message-resultat">Aucun token de vérification détecté.</p>' +
      '<a href="connexion.html" class="bouton-retour">Retour à la connexion</a>'
    return
  }

  try {
    const reponse = await fetch(URL_BACKEND + '/api/verifier-email/' + token)
    const resultat = await reponse.json()
    if (resultat.succes) {
      carte.innerHTML =
        '<div class="icone-resultat">✅</div>' +
        '<h1 class="titre-resultat">Email vérifié !</h1>' +
        '<p class="message-resultat">Merci, votre adresse <strong>' + resultat.email + '</strong> est maintenant confirmée.</p>' +
        '<a href="espace-client.html" class="bouton-retour">Accéder à mon espace</a>'
    } else {
      carte.innerHTML =
        '<div class="icone-resultat">⚠️</div>' +
        '<h1 class="titre-resultat">Lien invalide</h1>' +
        '<p class="message-resultat">' + (resultat.message || 'Le lien a expiré ou est incorrect.') + '</p>' +
        '<a href="connexion.html" class="bouton-retour">Retour à la connexion</a>'
    }
  } catch (e) {
    carte.innerHTML =
      '<div class="icone-resultat">⚠️</div>' +
      '<h1 class="titre-resultat">Erreur réseau</h1>' +
      '<p class="message-resultat">Impossible de contacter le serveur. Réessayez plus tard.</p>' +
      '<a href="index.html" class="bouton-retour">Retour à l\'accueil</a>'
  }
}


/* Utilisateur : supprime son propre compte (RGPD — droit à l'effacement) */
async function supprimerMonCompte() {
  if (!confirm('Êtes-vous sûr(e) de vouloir supprimer votre compte ?\n\nCette action est irréversible.')) return
  const session = lireSession()
  if (!session) return

  const bouton = document.getElementById('bouton-supprimer-compte')
  const message = document.getElementById('message-suppression')
  if (bouton) bouton.disabled = true
  if (message) message.innerHTML = '<p style="color: var(--couleur-texte-secondaire); margin-top: 12px;">Suppression en cours…</p>'

  try {
    const reponse = await fetch(URL_BACKEND + '/api/compte', {
      method:  'DELETE',
      headers: { 'Authorization': 'Bearer ' + session.token }
    })
    const resultat = await reponse.json()

    if (resultat.succes) {
      if (message) message.innerHTML = '<p style="color: #2E7D32; margin-top: 12px;">✓ Compte supprimé. Redirection…</p>'
      setTimeout(function() {
        deconnecter()
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


/* Charge les statistiques depuis /api/admin/stats et remplit le dashboard.
   Protège aussi la page : si l'utilisateur n'est pas admin (403), redirection. */
async function chargerDashboardAdmin() {
  const session = lireSession()
  const zoneMessage = document.getElementById('admin-message')
  const zoneContenu = document.getElementById('admin-contenu')

  /* Vérification locale avant même de faire l'appel API */
  if (!session || !session.token) {
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
      headers: { 'Authorization': 'Bearer ' + session.token }
    })

    if (reponse.status === 401) {
      /* Token expiré : on déconnecte et redirige */
      deconnecter()
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

    /* Remplissage des cartes KPI */
    document.getElementById('kpi-inscriptions').textContent  = s.totalInscriptions
    document.getElementById('kpi-comptes').textContent       = s.totalComptes
    document.getElementById('kpi-premium').textContent       = s.comptesParStatut.Premium
    document.getElementById('kpi-leads').textContent         = s.totalLeads
    document.getElementById('kpi-transactions').textContent  = s.totalTransactions
    document.getElementById('kpi-revenu').textContent        = s.totalRevenu + ' €'

    /* Répartitions (barres) */
    construireBarres(s.crmParFormation,   'repartition-formations')
    construireBarres(s.leadsParPipeline,  'repartition-pipeline')

    /* Tableaux des dernières entrées */
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

  /* Mise à jour de la navigation selon l'état de connexion (toutes pages) */
  majNavigation()

  /* Pages formation-*.html : configure l'accès au contenu Premium */
  if (document.querySelector('.contenu-premium')) {
    configurerAccesFormation()
  }

  /* Page paiement.html : initialise selon l'état de l'utilisateur */
  if (document.getElementById('conteneur-paiement')) {
    initialiserPagePaiement()
  }

  /* Page admin.html : charge le dashboard si on est admin */
  if (document.getElementById('admin-contenu')) {
    chargerDashboardAdmin()
  }

  /* Page espace-client.html : zone de danger visible uniquement si connecté */
  const zoneDanger = document.getElementById('zone-danger-compte')
  if (zoneDanger) {
    if (lireSession()) zoneDanger.style.display = 'block'
    const boutonSuppr = document.getElementById('bouton-supprimer-compte')
    if (boutonSuppr) boutonSuppr.addEventListener('click', supprimerMonCompte)
  }

  /* Page reset-mot-de-passe.html : bascule automatique demande / confirmation
     selon la présence du paramètre ?token dans l'URL */
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

  /* Page verification-email.html : vérification automatique au chargement */
  if (document.getElementById('carte-verif')) {
    traiterVerificationEmail()
  }

  /* Formulaire de connexion — présent uniquement sur connexion.html */
  const formulaireConnexion = document.getElementById('formulaire-connexion')
  if (formulaireConnexion) {
    formulaireConnexion.addEventListener('submit', envoyerConnexion)
  }

  /* Formulaire de création de compte — présent sur inscription-compte.html */
  const formulaireCompte = document.getElementById('formulaire-inscription-compte')
  if (formulaireCompte) {
    formulaireCompte.addEventListener('submit', envoyerCreationCompte)

    /* Si l'URL contient ?formation=IA|SCRUM|SAP (redirigé depuis formations.html),
       on pré-sélectionne la formation d'intérêt dans le formulaire */
    const parametres = new URLSearchParams(window.location.search)
    const formationPreselectionnee = parametres.get('formation')
    if (formationPreselectionnee) {
      const selectFormation = document.getElementById('formation')
      if (selectFormation) selectFormation.value = formationPreselectionnee
    }
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

})
