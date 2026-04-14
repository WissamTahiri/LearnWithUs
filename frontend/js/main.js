/* ============================================================
   main.js — JavaScript principal de LearnWithUs
   ============================================================
   Ce fichier contient TOUTES les fonctions JavaScript du site.
   Il est chargé par chaque page HTML via <script src="js/main.js">.

   JavaScript (JS) permet de rendre les pages INTERACTIVES :
   - Ouvrir/fermer le menu mobile
   - Envoyer des formulaires sans recharger la page
   - Basculer entre les onglets
   - Animer l'accordéon FAQ

   IMPORTANT : Ce fichier est chargé sur TOUTES les pages, mais
   certaines fonctions ne s'exécutent que si les éléments HTML
   correspondants existent (on vérifie avec 'if').
   ============================================================ */


/* ============================================================
   CONSTANTE : URL DU BACKEND
   ============================================================
   Cette constante stocke l'adresse de notre serveur backend.

   EN DÉVELOPPEMENT LOCAL :
     Le backend tourne sur votre machine, port 3000.
     → URL_BACKEND = 'http://localhost:3000'

   EN PRODUCTION (après déploiement sur Render) :
     Le backend a une adresse publique fournie par Render.
     → URL_BACKEND = 'https://votre-app.onrender.com'

   Pour passer en production, il suffit de changer cette ligne.
   Tout le reste du code utilise cette variable, donc le
   changement se fait à UN SEUL endroit.
   ============================================================ */
const URL_BACKEND = 'http://localhost:3000'


/* ============================================================
   FONCTION 1 : Menu mobile (hamburger ☰)
   ============================================================
   gereMenuMobile()

   Active ou désactive le menu de navigation sur mobile.
   Appelée au clic sur le bouton hamburger ☰.

   CONCEPTS EXPLIQUÉS :
   - DOM (Document Object Model) : c'est la représentation en
     mémoire de la page HTML sous forme d'arbre d'objets.
     Chaque balise HTML devient un "noeud" qu'on peut manipuler
     avec JavaScript. Par exemple, document.querySelector('.nav-liens')
     cherche dans le DOM l'élément qui a la classe 'nav-liens'.

   - classList.toggle('classe') : ajoute la classe si elle
     n'existe pas, la retire si elle existe déjà. C'est comme
     un interrupteur ON/OFF pour une classe CSS.

   - Pourquoi séparer HTML et JS ? Le HTML définit la STRUCTURE
     (ce qui existe), le CSS définit l'APPARENCE (comment ça se voit),
     et le JS définit le COMPORTEMENT (ce qui se passe au clic).
     Cette séparation rend le code plus facile à maintenir.
   ============================================================ */
function gereMenuMobile() {
  /* querySelector cherche le PREMIER élément correspondant
     au sélecteur CSS donné. Ici, on cherche la liste des liens. */
  const liensNavigation = document.querySelector('.nav-liens')

  /* toggle ajoute 'menu-ouvert' si absent, le retire si présent.
     En CSS, .nav-liens.menu-ouvert a display:flex, ce qui
     rend les liens visibles. Sans cette classe, ils sont cachés. */
  liensNavigation.classList.toggle('menu-ouvert')
}


/* ============================================================
   FONCTION 2 : Envoi du formulaire d'inscription
   ============================================================
   envoyeInscription(evenement)

   Récupère les données du formulaire d'inscription,
   les envoie au serveur backend, et affiche le résultat.

   @param {Event} evenement - L'événement 'submit' du formulaire.
     Le navigateur crée automatiquement cet objet quand le
     formulaire est soumis. Il contient des infos sur l'événement
     et des méthodes comme preventDefault().

   @returns {void} - Ne retourne rien, mais modifie le DOM
     pour afficher un message de succès ou d'erreur.

   Le mot-clé 'async' devant la fonction indique qu'elle contient
   des opérations ASYNCHRONES (qui prennent du temps, comme un
   appel réseau). Cela permet d'utiliser 'await' à l'intérieur.
   ============================================================ */
async function envoyeInscription(evenement) {

  /* --- ÉTAPE 1 : Empêcher le rechargement de la page ---
     Par défaut, quand un formulaire HTML est soumis (bouton submit),
     le navigateur RECHARGE la page entière. C'est le comportement
     historique du web (avant JavaScript).
     preventDefault() annule ce comportement par défaut pour
     qu'on gère nous-mêmes l'envoi avec fetch() (sans rechargement). */
  evenement.preventDefault()

  /* --- ÉTAPE 2 : Récupérer les valeurs des champs ---
     document.getElementById('prenom') cherche dans le DOM
     l'élément HTML qui a l'attribut id="prenom".
     .value retourne le TEXTE que l'utilisateur a tapé dans ce champ.
     On construit un objet JavaScript avec toutes les données. */
  const donneesInscription = {
    prenom:    document.getElementById('prenom').value,
    nom:       document.getElementById('nom').value,
    email:     document.getElementById('email').value,
    formation: document.getElementById('formation').value,
    telephone: document.getElementById('telephone').value
  }

  /* --- ÉTAPE 3 : Désactiver le bouton pendant l'envoi ---
     On récupère le bouton submit du formulaire.
     On le désactive pour éviter que l'utilisateur clique
     plusieurs fois par impatience (ce qui enverrait les données
     en double). On change aussi le texte pour indiquer l'envoi. */
  const boutonEnvoi = evenement.target.querySelector(
    'button[type="submit"]'
  )
  const texteOriginal = boutonEnvoi.textContent
  boutonEnvoi.disabled = true
  boutonEnvoi.textContent = 'Envoi en cours...'

  /* --- ÉTAPE 4 : Envoyer au backend avec fetch() ---
     fetch() est une fonction MODERNE du navigateur pour faire
     des requêtes HTTP sans recharger la page.
     Anciennement, on utilisait XMLHttpRequest (AJAX), mais
     fetch() est plus simple et retourne une Promise.

     On envoie en JSON car c'est le format standard des APIs.
     Le serveur (server.js) attend du JSON.

     try...catch : si une erreur survient pendant l'envoi
     (serveur inaccessible, erreur réseau), le code dans
     'catch' s'exécute au lieu de planter la page. */
  try {
    const reponse = await fetch(URL_BACKEND + '/api/inscription', {
      /* method: 'POST' indique qu'on ENVOIE des données
         (contrairement à GET qui DEMANDE des données) */
      method: 'POST',

      /* headers indique au serveur le format des données.
         'Content-Type: application/json' signifie : "les données
         que je t'envoie sont au format JSON". */
      headers: { 'Content-Type': 'application/json' },

      /* body contient les données à envoyer.
         JSON.stringify() convertit l'objet JavaScript en texte JSON :
         { prenom: "Alice" } → '{"prenom":"Alice"}'
         Car HTTP ne peut transporter que du TEXTE, pas des objets JS. */
      body: JSON.stringify(donneesInscription)
    })

    /* --- ÉTAPE 5 : Lire la réponse JSON du serveur ---
       Le serveur répond aussi en JSON. .json() convertit
       le texte JSON de la réponse en objet JavaScript.
       'await' attend que la conversion soit terminée. */
    const resultat = await reponse.json()

    /* --- ÉTAPE 6 : Afficher le message de succès ou d'erreur ---
       On cible la zone de message dans le DOM et on y écrit
       le résultat. La classe CSS détermine la couleur
       (vert pour succès, rouge pour erreur). */
    const zoneMessage = document.getElementById(
      'message-inscription'
    )

    if (resultat.succes) {
      /* Le serveur a confirmé l'inscription */
      zoneMessage.className = 'message-succes'
      zoneMessage.textContent =
        'Merci ' + donneesInscription.prenom + ' ! ' +
        'Votre inscription a bien été reçue. ' +
        'Un email de confirmation vous a été envoyé.'

      /* reset() vide TOUS les champs du formulaire d'un coup.
         C'est une méthode native des éléments <form>. */
      document.getElementById('form-inscription').reset()
    } else {
      /* Le serveur a renvoyé une erreur */
      zoneMessage.className = 'message-erreur'
      zoneMessage.textContent =
        resultat.message ||
        'Une erreur est survenue. Veuillez réessayer.'
    }

  } catch (erreur) {
    /* Si le serveur est inaccessible ou qu'il y a une erreur réseau,
       on affiche un message d'erreur à l'utilisateur.
       console.error() écrit dans la console du navigateur
       (F12 → onglet Console) pour le débogage. */
    console.error('Erreur lors de l\'inscription :', erreur)
    const zoneMessage = document.getElementById(
      'message-inscription'
    )
    zoneMessage.className = 'message-erreur'
    zoneMessage.textContent =
      'Impossible de contacter le serveur. ' +
      'Vérifiez votre connexion et réessayez.'
  }

  /* --- ÉTAPE 7 : Réactiver le bouton ---
     Quel que soit le résultat (succès ou erreur), on réactive
     le bouton pour que l'utilisateur puisse réessayer. */
  boutonEnvoi.disabled = false
  boutonEnvoi.textContent = texteOriginal
}


/* ============================================================
   FONCTION 3 : Envoi du formulaire de contact
   ============================================================
   envoyeContact(evenement)

   Même structure que envoyeInscription, mais adaptée pour
   le formulaire de contact (champs différents, route différente).

   @param {Event} evenement - L'événement 'submit' du formulaire
   @returns {void}
   ============================================================ */
async function envoyeContact(evenement) {
  evenement.preventDefault()

  /* Récupère les données du formulaire de contact.
     Les id sont préfixés par 'contact-' pour éviter les
     conflits avec le formulaire d'inscription
     (les deux sont dans le même fichier JS). */
  const donneesContact = {
    prenom: document.getElementById('contact-prenom').value,
    nom:    document.getElementById('contact-nom').value,
    email:  document.getElementById('contact-email').value,
    sujet:  document.getElementById('contact-sujet').value,
    message: document.getElementById('contact-message').value
  }

  /* Désactive le bouton pendant l'envoi */
  const boutonEnvoi = evenement.target.querySelector(
    'button[type="submit"]'
  )
  const texteOriginal = boutonEnvoi.textContent
  boutonEnvoi.disabled = true
  boutonEnvoi.textContent = 'Envoi en cours...'

  try {
    /* Envoie vers la route /api/contact du backend */
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
        'Votre message a bien été reçu. ' +
        'Nous vous répondrons sous 24h.'
      document.getElementById('form-contact').reset()
    } else {
      zoneMessage.className = 'message-erreur'
      zoneMessage.textContent =
        resultat.message ||
        'Une erreur est survenue. Veuillez réessayer.'
    }

  } catch (erreur) {
    console.error('Erreur lors de l\'envoi du contact :', erreur)
    const zoneMessage = document.getElementById('message-contact')
    zoneMessage.className = 'message-erreur'
    zoneMessage.textContent =
      'Impossible de contacter le serveur. ' +
      'Vérifiez votre connexion et réessayez.'
  }

  boutonEnvoi.disabled = false
  boutonEnvoi.textContent = texteOriginal
}


/* ============================================================
   FONCTION 4 : Gestion des onglets (espace client)
   ============================================================
   basculerOnglet(nomOnglet)

   Affiche le contenu de l'onglet demandé et cache les autres.
   Met à jour visuellement quel bouton onglet est actif.

   @param {string} nomOnglet - 'standard' ou 'premium'
     Correspond à la partie après 'contenu-' dans l'id du div
     (ex: 'standard' → id="contenu-standard")

   @returns {void}
   ============================================================ */
function basculerOnglet(nomOnglet) {

  /* --- Étape 1 : Cacher tous les contenus d'onglets ---
     querySelectorAll retourne TOUS les éléments correspondant
     au sélecteur (contrairement à querySelector qui retourne
     le premier seulement). Le résultat est une NodeList,
     qu'on parcourt avec forEach. */
  const tousLesContenus = document.querySelectorAll(
    '.onglet-contenu'
  )
  tousLesContenus.forEach(function(contenu) {
    /* On retire la classe 'actif' de chaque contenu.
       En CSS, sans 'actif', l'onglet a display: none (caché). */
    contenu.classList.remove('actif')
  })

  /* --- Étape 2 : Désactiver tous les boutons onglets --- */
  const tousLesBoutons = document.querySelectorAll(
    '.onglet-bouton'
  )
  tousLesBoutons.forEach(function(bouton) {
    bouton.classList.remove('actif')
  })

  /* --- Étape 3 : Activer l'onglet demandé ---
     On construit l'id dynamiquement : 'contenu-' + nomOnglet
     Ex: 'contenu-' + 'premium' → 'contenu-premium' */
  const contenuCible = document.getElementById(
    'contenu-' + nomOnglet
  )
  if (contenuCible) {
    contenuCible.classList.add('actif')
  }

  /* --- Étape 4 : Activer le bon bouton ---
     On cherche le bouton qui contient le texte correspondant
     à l'onglet demandé. On parcourt tous les boutons et on
     vérifie le texte de chacun. */
  tousLesBoutons.forEach(function(bouton) {
    /* textContent retourne le texte visible du bouton.
       toLowerCase() met tout en minuscules pour une comparaison
       insensible à la casse (Standard = standard). */
    if (bouton.textContent.toLowerCase().includes(nomOnglet)) {
      bouton.classList.add('actif')
    }
  })
}


/* ============================================================
   FONCTION 5 : Accordéon FAQ
   ============================================================
   basculerFAQ(bouton)

   Ouvre la réponse FAQ associée au bouton cliqué.
   Ferme toutes les autres réponses ouvertes pour qu'une
   seule soit visible à la fois.

   @param {HTMLElement} bouton - Le bouton question qui a été cliqué.
     'this' dans le onclick HTML fait référence au bouton lui-même.

   @returns {void}
   ============================================================ */
function basculerFAQ(bouton) {

  /* parentElement remonte d'un niveau dans le DOM.
     Le bouton est DANS le div.accordeon-element, donc
     parentElement retourne ce div. C'est lui qui recevra
     la classe 'ouvert' pour afficher la réponse. */
  const element = bouton.parentElement

  /* Vérifie si cet élément est DÉJÀ ouvert.
     classList.contains() retourne true ou false. */
  const estDejaOuvert = element.classList.contains('ouvert')

  /* --- Ferme TOUS les éléments de l'accordéon ---
     On ferme d'abord tout, puis on ouvre celui qui a été cliqué
     (sauf s'il était déjà ouvert, auquel cas il reste fermé). */
  const tousLesElements = document.querySelectorAll(
    '.accordeon-element'
  )
  tousLesElements.forEach(function(el) {
    el.classList.remove('ouvert')
  })

  /* Si l'élément n'était PAS ouvert, on l'ouvre.
     S'il était déjà ouvert, on ne fait rien (il vient
     d'être fermé par la boucle ci-dessus). */
  if (!estDejaOuvert) {
    element.classList.add('ouvert')
  }
}


/* ============================================================
   FONCTION 6 : Message abonnement Premium
   ============================================================
   afficherMessageAbonnement()

   Affiche un message informatif quand l'utilisateur clique
   sur le bouton "S'abonner". L'intégration Stripe n'est
   pas encore faite, donc on redirige vers la page contact.

   @returns {void}
   ============================================================ */
function afficherMessageAbonnement() {
  const zoneMessage = document.getElementById(
    'message-abonnement'
  )
  zoneMessage.className = 'message-succes'
  zoneMessage.innerHTML =
    'Intégration Stripe en cours de développement. ' +
    'Contactez-nous sur la page ' +
    '<a href="contact.html">Contact</a> ' +
    'pour un accès anticipé.'
}


/* ============================================================
   INITIALISATION AU CHARGEMENT DE LA PAGE
   ============================================================
   DOMContentLoaded est un événement qui se déclenche quand
   le navigateur a FINI de lire tout le HTML de la page.

   Pourquoi attendre ? Si on essaie de chercher un élément
   (getElementById) avant que le HTML ne soit chargé, l'élément
   n'existe pas encore et on obtient 'null'.

   addEventListener('DOMContentLoaded', function) dit :
   "Quand le DOM est prêt, exécute cette fonction."

   On y attache les gestionnaires d'événements (submit, click)
   aux éléments qui existent sur la page actuelle.
   ============================================================ */
document.addEventListener('DOMContentLoaded', function() {

  /* --- Formulaire d'inscription ---
     On vérifie d'abord que le formulaire EXISTE sur cette page.
     Ce fichier JS est chargé sur TOUTES les pages, mais le
     formulaire d'inscription n'existe que sur formations.html.
     Sans ce 'if', on aurait une erreur sur les autres pages. */
  const formulaireInscription = document.getElementById(
    'form-inscription'
  )
  if (formulaireInscription) {
    /* addEventListener attache une fonction à un événement.
       'submit' se déclenche quand le formulaire est soumis.
       On appelle notre fonction envoyeInscription qui gère tout. */
    formulaireInscription.addEventListener(
      'submit', envoyeInscription
    )
  }

  /* --- Formulaire de contact ---
     Même logique : on vérifie que le formulaire existe
     (il n'est présent que sur contact.html). */
  const formulaireContact = document.getElementById(
    'form-contact'
  )
  if (formulaireContact) {
    formulaireContact.addEventListener('submit', envoyeContact)
  }

  /* --- Menu mobile ---
     On attache la fonction gereMenuMobile au bouton hamburger.
     Le bouton existe sur TOUTES les pages (dans la navigation),
     mais on vérifie quand même par sécurité. */
  const boutonMenu = document.querySelector('.menu-mobile')
  if (boutonMenu) {
    boutonMenu.addEventListener('click', gereMenuMobile)
  }

  /* --- Boutons "S'inscrire à cette formation" ---
     Ces boutons existent sur formations.html et font 2 choses :
     1. Font défiler la page jusqu'au formulaire d'inscription
     2. Pré-sélectionnent la bonne formation dans le menu déroulant

     L'attribut data-formation="IA" (ou "SCRUM" ou "SAP") sur
     chaque bouton indique quelle formation pré-sélectionner.
     dataset.formation lit la valeur de cet attribut. */
  const boutonsInscription = document.querySelectorAll(
    '.bouton-inscription'
  )
  boutonsInscription.forEach(function(bouton) {
    bouton.addEventListener('click', function() {

      /* Récupère la valeur de l'attribut data-formation
         Ex: data-formation="IA" → bouton.dataset.formation = "IA" */
      const formationChoisie = bouton.dataset.formation

      /* Pré-sélectionne la formation dans le menu déroulant.
         On change la propriété .value du <select> pour qu'il
         affiche automatiquement la bonne option. */
      const selectFormation = document.getElementById('formation')
      if (selectFormation && formationChoisie) {
        selectFormation.value = formationChoisie
      }

      /* Fait défiler la page jusqu'au formulaire.
         scrollIntoView() est une méthode native qui fait
         apparaître l'élément dans la zone visible.
         behavior: 'smooth' = défilement animé (pas instantané). */
      const sectionFormulaire = document.getElementById(
        'formulaire-inscription'
      )
      if (sectionFormulaire) {
        sectionFormulaire.scrollIntoView({ behavior: 'smooth' })
      }
    })
  })

})
