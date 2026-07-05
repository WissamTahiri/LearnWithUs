/* =============================================================
   presentation.js — chef d'orchestre : navigation, HUD, clavier,
   et SYNCHRONISATION son ↔ animation :
   - lancement  : warp caméra 3D + riser audio + flash à l'arrivée
   - même acte  : transition 3D des slides + kick caméra + cascade
                  de notes calée sur l'apparition des éléments
   - nouvel acte: balayage lumineux + sweep stéréo + arpège + voyage
   ============================================================= */
(function () {
  'use strict';

  var slides = [], idx = 0, chapitreCourant = -1, demarre = false;
  var ACTES = ['Acte I · Notre projet', 'Acte II · Le produit', 'Acte III · La démo',
               'Acte IV · La confiance', 'Acte V · La méthode', 'Acte VI · Conclusion'];
  var DUREE_WARP = 15000;   /* le Grand Tour : survol des six mondes avant le portail */
  var posDansActe = [];   /* rang de chaque slide au sein de son acte */
  var debutActe = [];     /* index de la première slide de chaque acte (touches 1-6) */
  var reduit = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var tIdle = null;       /* minuteur d'auto-masquage du HUD */

  var elBarre, elCompteurN, elCompteurTot, elMini, elIntro, elMute, elBalayage, elFlash, elNova;

  /* Impact frame : une frame blanche pure de 120 ms — l'arme des trailers */
  function nova() {
    if (!elNova) return;
    elNova.classList.remove('actif');
    void elNova.offsetWidth;
    elNova.classList.add('actif');
  }

  function chapitreDe(s) { return parseInt(s.getAttribute('data-chapitre') || '0', 10); }
  function nbAnims(s) { return s.querySelectorAll('[data-anim]').length; }

  function afficher(n, dir) {
    n = Math.max(0, Math.min(slides.length - 1, n));
    if (n === idx && demarre && dir !== 0) return;
    var precedente = slides[idx] || null;   /* la slide qui va partir */

    /* Positionnement 3D : déjà vues à gauche (.passe), à venir à droite */
    slides.forEach(function (s, i) {
      s.classList.remove('actif');
      s.classList.toggle('passe', i < n);
    });
    slides[n].classList.add('actif');
    idx = n;

    /* HUD */
    elBarre.style.width = ((idx + 1) / slides.length * 100) + '%';
    elCompteurN.textContent = (idx + 1);
    var ch = chapitreDe(slides[idx]);
    elMini.textContent = (ACTES[ch] ? ACTES[ch] + '  —  ' : '') +
                         (slides[idx].getAttribute('data-titre') || '');
    majCarte(ch);

    var changeActe = ch !== chapitreCourant;
    chapitreCourant = ch;

    var derniere = idx === slides.length - 1 && dir > 0;

    if (dir !== 0) {
      /* Caméra : 6 trajectoires · Audio : 8 timbres. Les deux cycles
         sont premiers entre eux → 24 combinaisons, jamais deux slides
         d'affilée avec la même sensation. */
      var styleCam = idx % 6;
      var styleSon = idx % 8;
      document.body.setAttribute('data-cam', styleCam);   /* l'entrée DOM épouse la trajectoire */

      /* La slide qui part est chorégraphiée (sortie miroir, 450 ms) :
         plus jamais deux slides lisibles en double exposition */
      if (!reduit && precedente && precedente !== slides[idx]) {
        precedente.classList.add('sortante');
        setTimeout(function () { precedente.classList.remove('sortante'); }, 520);
      }
      /* secousse caméra : le décor encaisse le changement de slide */
      if (!reduit && window.Scene3D && Scene3D.kick) Scene3D.kick(dir);

      /* onde d'atterrissage : un cercle d'or souligne la pose de la slide */
      if (!reduit) {
        clearTimeout(afficher._tOnde);
        afficher._tOnde = setTimeout(function () {
          var o = document.getElementById('onde-dom');
          if (!o) return;
          o.classList.remove('actif'); void o.offsetWidth; o.classList.add('actif');
        }, changeActe ? 2150 : 900);
      }

      if (derniere) {
        /* [7] réduction de mouvement : la conclusion sans l'acrobatie */
        if (reduit) {
          if (window.Scene3D) Scene3D.goToChapitre(ch);
          if (window.AudioFX) AudioFX.apotheose();
          return;
        }
        /* ===== MISE EN SCÈNE DE LA SUPERNOVA =====
           Le texte final NAÎT de la déflagration : écran masqué pendant
           la charge, flash + révélation à l'instant de l'explosion. */
        document.body.classList.add('warp');       /* cache scène + HUD */
        document.body.classList.add('finale');     /* voile abaissé : le fond gagne */
        if (window.Scene3D && Scene3D.finale) {
          Scene3D.finale(function () {
            /* le texte NAÎT du flash : impact frame blanche + cascade d'entrée */
            nova();
            if (window.AudioFX && AudioFX.shimmer) AudioFX.shimmer();
            slides[idx].classList.remove('actif');
            void slides[idx].offsetWidth;
            slides[idx].classList.add('actif');
            elFlash.classList.add('actif');
            document.body.classList.remove('warp');
            if (window.AudioFX) AudioFX.cascade(nbAnims(slides[idx]), ch);
            setTimeout(function () { elFlash.classList.remove('actif'); }, 700);
          });
        } else {
          document.body.classList.remove('warp');
        }
        if (window.AudioFX) AudioFX.apotheose();   /* charge 0,95 s → hit, calé sur la 3D */
        setTimeout(function () { document.body.classList.remove('finale'); }, 17000);
        return;
      }

      /* Le contenu attend que le décor se calme (~0,45 s de retard) ;
         en TRAVERSÉE inter-acte, il attend carrément l'arrivée (~1,1 s) :
         le tunnel joue seul, la slide se pose quand le monde est là. */
      if (!reduit) {
        document.body.classList.add('voyage');
        if (changeActe) document.body.classList.add('traversee');
        clearTimeout(afficher._tVoyage);
        clearTimeout(afficher._tTrav);
        afficher._tVoyage = setTimeout(function () {
          document.body.classList.remove('voyage');
        }, 800);
        afficher._tTrav = setTimeout(function () {
          document.body.classList.remove('traversee');
        }, 2100);
      }

      if (window.Scene3D) {
        /* [7] réduit : glissement doux existant, pas d'acrobatie caméra */
        if (reduit) Scene3D.goToChapitre(ch);
        else if (Scene3D.voyage) Scene3D.voyage(ch, posDansActe[idx] || 0, dir, styleCam, changeActe);
      }
      if (window.AudioFX) {
        if (changeActe) {
          /* balayage lumineux + son stéréo qui traverse l'écran ensemble,
             détaché 150 ms après le départ caméra pour rester visible */
          setTimeout(function () {
            elBalayage.classList.remove('actif');
            void elBalayage.offsetWidth;
            elBalayage.classList.add('actif');
          }, 150);
          AudioFX.sweep(true);      /* souffle long : toute la traversée + signature à l'arrivée */
          AudioFX.arpege(ch);
        } else {
          AudioFX.transition(styleSon, dir);
        }
        if (slides[idx].getAttribute('data-titre') === 'Manifeste') {
          AudioFX.manifeste();      /* trois battements calés sur les lignes */
        } else if (changeActe) {
          /* la cascade sonore attend que la slide se pose (arrivée de traversée) */
          setTimeout(function () { AudioFX.cascade(nbAnims(slides[idx]), ch); }, 1350);
        } else {
          AudioFX.cascade(nbAnims(slides[idx]), ch);
        }
      }
    }
  }

  function suivant() { if (idx < slides.length - 1) afficher(idx + 1, 1); }
  function precedent() { if (idx > 0) afficher(idx - 1, -1); }

  function pleinEcran() {
    var el = document.documentElement;
    if (!document.fullscreenElement) { (el.requestFullscreen || el.webkitRequestFullscreen || function () {}).call(el); }
    else { (document.exitFullscreen || document.webkitExitFullscreen || function () {}).call(document); }
  }

  /* Lancement : intro → warp 3D + riser → flash → première slide */
  function lancer() {
    if (demarre) return;
    demarre = true;
    document.body.classList.remove('accueil');
    if (window.AudioFX) AudioFX.unlock();
    /* nappe d'ambiance VOLONTAIREMENT muette : le son n'existe
       que sur les transitions (demande user : zéro bruit de fond) */

    elIntro.classList.add('parti');
    setTimeout(function () { elIntro.style.display = 'none'; }, 750);
    document.body.classList.add('warp');       /* cache HUD + slides pendant le voyage */

    var arrivee = function () {
      nova();                     /* impact frame : l'arrivée AVEUGLE, elle ne brunit pas */
      if (window.AudioFX && AudioFX.shimmer) AudioFX.shimmer();   /* les lettres naissent, l'air scintille */
      elFlash.classList.add('actif');
      document.body.classList.remove('warp');
      idx = -1; chapitreCourant = -1;
      afficher(0, 0);
      if (window.AudioFX) AudioFX.cascade(4, 0);
      setTimeout(function () { elFlash.classList.remove('actif'); }, 700);
    };

    if (!reduit && window.Scene3D && window.Scene3D.warpIntro) {
      /* la partition du tour est jouée PAR la 3D : arpège + boum à chaque
         monde survolé, riser déclenché pour finir pile à l'arrivée */
      if (window.AudioFX) AudioFX.ouverture();
      Scene3D.warpIntro(DUREE_WARP, arrivee);
    } else {
      if (window.AudioFX && !reduit) AudioFX.ouverture();
      document.body.classList.remove('warp');
      arrivee();
    }
    /* n'ENTRE en plein écran que si on n'y est pas déjà — ne jamais en sortir ici */
    try {
      if (!document.fullscreenElement) {
        var elFs = document.documentElement;
        (elFs.requestFullscreen || elFs.webkitRequestFullscreen || function () {}).call(elFs);
      }
    } catch (e) {}
  }

  function majMute(m) {
    var u = document.getElementById('use-mute');
    if (u) u.setAttribute('href', m ? '#i-muet' : '#i-son');
  }

  /* ===== Carte du voyage + rideau noir ===== */

  function majCarte(ch) {
    var pts = document.querySelectorAll('#carte-voyage .monde');
    pts.forEach(function (m, i) { m.classList.toggle('actif', i === ch); });
  }

  function construireCarte() {
    var nav = document.getElementById('carte-voyage');
    var noms = ['Projet', 'Produit', 'Démo', 'Confiance', 'Méthode', 'Final'];
    noms.forEach(function (nom, i) {
      var d = document.createElement('button');
      d.className = 'monde';
      d.setAttribute('aria-label', 'Acte ' + (i + 1) + ' · ' + nom);
      d.innerHTML = '<span class="nom">' + nom + '</span>';
      d.addEventListener('click', function () {
        if (!demarre) return;
        var cible = debutActe[i];
        if (cible !== undefined) afficher(cible, cible >= idx ? 1 : -1);
      });
      nav.appendChild(d);
    });
  }


  document.addEventListener('DOMContentLoaded', function () {
    document.body.classList.add('accueil');   /* HUD masqué tant que le rideau est levé */
    slides = Array.prototype.slice.call(document.querySelectorAll('.slide'));
    /* Rang de chaque slide dans son acte (pour les points de vue en orbite) */
    var compteurs = {};
    slides.forEach(function (s, i) {
      var c = chapitreDe(s);
      compteurs[c] = (compteurs[c] || 0);
      posDansActe[i] = compteurs[c];
      if (compteurs[c] === 0) debutActe[c] = i;
      compteurs[c]++;
    });
    elBarre = document.getElementById('barre-progression');
    elCompteurN = document.getElementById('compteur-n');
    elCompteurTot = document.getElementById('compteur-tot');
    elMini = document.getElementById('titre-mini');
    elIntro = document.getElementById('intro');
    elMute = document.getElementById('btn-mute');
    elBalayage = document.getElementById('balayage');
    elFlash = document.getElementById('flash-warp');
    elNova = document.getElementById('flash-nova');

    elCompteurTot.textContent = slides.length;

    /* Titres-spectacle : chaque lettre des grands titres naît séparément
       (y compris le logo de l'écran d'accueil : le show commence AVANT le clic) */
    document.querySelectorAll('.slide-titre-xxl, #intro .logo-i').forEach(function (h) {
      var txt = h.textContent;
      h.textContent = '';
      txt.split('').forEach(function (c, i) {
        var s = document.createElement('span');
        s.className = 'ltr';
        s.style.setProperty('--i', i);
        s.textContent = c === ' ' ? ' ' : c;
        h.appendChild(s);
      });
    });

    if (window.Scene3D) Scene3D.init(document.getElementById('fond-3d'));
    if (window.AudioFX) AudioFX.onMute(majMute);
    construireCarte();

    document.getElementById('lancer').addEventListener('click', function () {
      lancer();
      tIdle = setTimeout(function () { document.body.classList.add('idle'); }, 3500);
    });
    document.getElementById('btn-prev').addEventListener('click', precedent);
    document.getElementById('btn-next').addEventListener('click', suivant);
    document.getElementById('nav-prev').addEventListener('click', precedent);
    document.getElementById('nav-next').addEventListener('click', suivant);
    document.getElementById('btn-plein').addEventListener('click', pleinEcran);
    elMute.addEventListener('click', function () { if (window.AudioFX) AudioFX.toggleMute(); });

    /* [5] HUD auto-masqué après 3,5 s sans mouvement de souris */
    function reveille() {
      document.body.classList.remove('idle');
      clearTimeout(tIdle);
      if (demarre) tIdle = setTimeout(function () { document.body.classList.add('idle'); }, 3500);
    }
    document.addEventListener('mousemove', reveille, { passive: true });
    document.addEventListener('touchstart', reveille, { passive: true });

    document.addEventListener('keydown', function (e) {
      if (!demarre) {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); lancer(); reveille(); }
        else if (e.key === 'f' || e.key === 'F') { pleinEcran(); }
        else if (e.key === 'm' || e.key === 'M') { if (window.AudioFX) AudioFX.toggleMute(); }
        return;
      }
      /* [5] sauts d'acte : touches 1 à 6 */
      if (e.key >= '1' && e.key <= '6') {
        var cible = debutActe[parseInt(e.key, 10) - 1];
        if (cible !== undefined) afficher(cible, cible >= idx ? 1 : -1);
        return;
      }
      switch (e.key) {
        case 'ArrowRight': case ' ': case 'PageDown': e.preventDefault(); suivant(); break;
        case 'ArrowLeft': case 'PageUp': e.preventDefault(); precedent(); break;
        case 'Home': afficher(0, -1); break;
        case 'End': afficher(slides.length - 1, 1); break;
        case 'f': case 'F': pleinEcran(); break;
        case 'm': case 'M': if (window.AudioFX) AudioFX.toggleMute(); break;
      }
    });

    var xDebut = null;
    document.addEventListener('touchstart', function (e) { xDebut = e.touches[0].clientX; }, { passive: true });
    document.addEventListener('touchend', function (e) {
      if (xDebut === null || !demarre) return;
      var dx = e.changedTouches[0].clientX - xDebut;
      if (dx < -50) suivant(); else if (dx > 50) precedent();
      xDebut = null;
    }, { passive: true });

    majMute(window.AudioFX ? AudioFX.muted : false);
  });
})();
