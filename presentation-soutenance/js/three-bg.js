/* =============================================================
   Scene3D v3 — un VRAI voyage entre six mondes (vanilla, r128)
   ------------------------------------------------------------
   Six zones thématiques distinctes, espacées le long d'un chemin
   sinueux (~760 unités) :
     0 · LE PORTAIL    — anneaux d'or concentriques (l'ouverture)
     1 · LA VITRINE    — galerie de panneaux flottants (le produit)
     2 · LE PIPELINE   — 4 pylônes reliés par un flux de données
                         qui circule en continu (la démo)
     3 · LA FORTERESSE — dôme protecteur + sentinelles (la confiance)
     4 · LE SYSTÈME    — planétarium : phases en orbite (la méthode)
     5 · LE CŒUR       — l'astre final, siège de la supernova
   Les changements d'acte sont de longues traversées (2,2 s) qui
   franchissent l'espace entre les mondes ; les slides d'un même
   acte orbitent autour de leur zone.
   ============================================================= */
(function (global) {
  'use strict';

  var scene, camera, renderer, composer, bloom;
  var monde, points, lignes, coeur;
  var horloge, souris = { x: 0, y: 0 }, cibleSouris = { x: 0, y: 0 };
  var waypoints = [], regards = [], accents = [];
  var camPos, camRegard, camPosCible, camRegardCible;
  var accentCourant = new THREE.Color('#E7B84B'), accentCible = new THREE.Color('#E7B84B');
  var actif = true;
  var FOV_BASE = 60;

  var warp = { actif: false, depart: 0, duree: 0, de: null, vers: null, fin: null, j1: false, j2: false, courbe: null, lastSpark: 0 };
  var trajet = { actif: false, depart: 0, duree: 0, courbe: null, roll: 0, fovAmp: 0, gerbeFaite: false, hyper: false, chap: 0 };
  var kick = { x: 0, z: 0 };
  var finale = { actif: false, depart: 0, duree: 7000, explose: false, cb: null };

  var tunnel = null, tunnelLignes = [];
  var ondes = [];
  var bursts = [];
  var animables = [];      /* objets qui tournent doucement */
  var zoneHeros = [[], [], [], [], [], []];   /* pièces maîtresses par monde (pulse d'accueil) */
  var cometes = [], prochaineComete = 0;      /* étoiles filantes */
  var flotteurs = [];                          /* objets 3D qui lévitent */
  var aurores = [];                            /* voiles boréaux ondulants */
  var marqueFin = null;                        /* LEARNWITHUS du final (face caméra) */
  var soleilCoeur = null;                      /* noyau incandescent : source des god rays */
  var bloomFX = null, rayons = null, aberration = null;   /* pipeline postprocessing */
  var fovPunch = { v: 0 };                     /* coup de zoom d'impact (GSAP) */
  /* GSAP pilote les courbes si présent (repli : nos easings maison) */
  var easeVol  = (typeof gsap !== 'undefined' && gsap.parseEase) ? gsap.parseEase('power4.inOut') : null;
  var easeTraj = (typeof gsap !== 'undefined' && gsap.parseEase) ? gsap.parseEase('power3.inOut') : null;
  var lucioles = null, lucioleData = [];       /* essaim autour du monde courant */
  var pulseZone = { chap: -1, t0: 0 };        /* le monde "salue" à l'arrivée */
  var fluxPts = null, fluxData = [];   /* flux de données du pipeline */
  var orbiteurs = [];      /* planètes du système orbital */
  var ronde = [];          /* astres de la ronde finale */

  /* Le chemin des six mondes : sinueux, profond */
  var ZONES = [
    new THREE.Vector3(0, 0, -30),
    new THREE.Vector3(85, 16, -175),
    new THREE.Vector3(-90, -12, -320),
    new THREE.Vector3(70, -20, -470),
    new THREE.Vector3(-75, 18, -615),
    new THREE.Vector3(0, 0, -760)
  ];
  var PALETTE = ['#E7B84B', '#F3C9D0', '#6B9BD1', '#E7B84B', '#E7734B', '#A5384A'];

  /* ---------- helpers ---------- */

  function spriteRond() {
    var c = document.createElement('canvas'); c.width = c.height = 64;
    var g = c.getContext('2d');
    var grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, 'rgba(255,255,255,1)');
    grad.addColorStop(0.3, 'rgba(255,235,220,0.9)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grad; g.fillRect(0, 0, 64, 64);
    var t = new THREE.Texture(c); t.needsUpdate = true; return t;
  }
  var TEXTURE_POINT = null;

  function easeWarp(x) { return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; }
  function easeInOut(x) { return x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2; }

  function fil(geo, couleur, opacite) {
    return new THREE.Mesh(geo, new THREE.MeshBasicMaterial({
      color: couleur, wireframe: true, transparent: true, opacity: opacite || 0.8
    }));
  }
  function tourne(obj, rx, ry) { animables.push({ o: obj, rx: rx, ry: ry }); return obj; }
  function heros(i, obj) { zoneHeros[i].push(obj); return obj; }
  function flotte(obj, amp, vitesse) {
    flotteurs.push({ o: obj, y0: obj.position.y, amp: amp || 0.9, sp: vitesse || 0.7, ph: Math.random() * 6 });
    return obj;
  }

  /* Texte MODÉLISÉ en 3D : lettres extrudées rendues en contours nets
     (EdgesGeometry) — même langage visuel filaire que le reste du monde. */
  var police3D = null;
  function texte3D(chaine, taille, couleur, opacite) {
    if (!police3D) return null;
    var geo = new THREE.TextGeometry(chaine, {
      font: police3D, size: taille, height: taille * 0.30,
      curveSegments: 5, bevelEnabled: false
    });
    geo.center();
    var contours = new THREE.LineSegments(
      new THREE.EdgesGeometry(geo, 14),
      new THREE.LineBasicMaterial({ color: couleur, transparent: true, opacity: opacite || 0.9 })
    );
    return contours;
  }

  /* Texte PLEIN : lettres extrudées et biseautées, faces lumineuses
     (MeshBasic = plein éclat, le bloom fait le reste) */
  function texteVolume(chaine, taille, couleurFace, couleurTranche) {
    if (!police3D) return null;
    var geo = new THREE.TextGeometry(chaine, {
      font: police3D, size: taille, height: taille * 0.34,
      curveSegments: 6, bevelEnabled: true,
      bevelThickness: taille * 0.04, bevelSize: taille * 0.028, bevelSegments: 2
    });
    geo.center();
    return new THREE.Mesh(geo, [
      new THREE.MeshBasicMaterial({ color: couleurFace }),
      new THREE.MeshBasicMaterial({ color: couleurTranche })
    ]);
  }

  /* Halo doux derrière un objet (sprite additive) */
  function haloLumineux(parent, couleur, sx, sy, opacite) {
    var sp = new THREE.Sprite(new THREE.SpriteMaterial({
      map: TEXTURE_POINT, color: couleur, transparent: true,
      opacity: opacite || 0.3, blending: THREE.AdditiveBlending, depthWrite: false
    }));
    sp.scale.set(sx, sy, 1);
    sp.position.set(0, 0, -1.2);
    parent.add(sp);
    return parent;
  }

  /* Plein (non filaire) */
  function plein(geo, couleur) {
    return new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: couleur }));
  }

  /* Le cycle SCRUM : deux flèches PLEINES qui se poursuivent (le sprint),
     aux couleurs agiles bleu / orange */
  function cycleScrum(c1, c2) {
    var g = new THREE.Group();
    var cols = [c1, c2];
    for (var i = 0; i < 2; i++) {
      var arc = plein(new THREE.TorusGeometry(3.1, 0.4, 10, 30, Math.PI * 0.8), cols[i]);
      arc.rotation.z = i * Math.PI;
      g.add(arc);
      var pointe = plein(new THREE.ConeGeometry(0.95, 1.9, 10), cols[i]);
      var aP = i * Math.PI + Math.PI * 0.8;
      pointe.position.set(Math.cos(aP) * 3.1, Math.sin(aP) * 3.1, 0);
      pointe.rotation.z = aP + Math.PI;
      g.add(pointe);
    }
    return g;
  }

  /* ---------- les six mondes ---------- */

  function construireZones() {
    var z0 = ZONES[0], z1 = ZONES[1], z2 = ZONES[2], z3 = ZONES[3], z4 = ZONES[4], z5 = ZONES[5];

    /* 0 · LE PORTAIL — trois anneaux d'or concentriques, inclinés */
    [10, 13.5, 17].forEach(function (r, i) {
      var a = fil(new THREE.TorusGeometry(r, 0.28, 10, 60), 0xE7B84B, 0.7 - i * 0.12);
      a.position.copy(z0);
      a.rotation.x = 0.45 + i * 0.12; a.rotation.y = i * 0.5;
      monde.add(heros(0, tourne(a, 0.02 + i * 0.012, 0.05 - i * 0.01)));
    });
    var noyau0 = fil(new THREE.IcosahedronGeometry(2.6, 0), 0xF3C9D0, 0.9);
    noyau0.position.copy(z0); monde.add(tourne(noyau0, 0.2, 0.3));

    /* 1 · LA VITRINE — galerie de huit panneaux flottants */
    for (var v = 0; v < 8; v++) {
      var pan = fil(new THREE.BoxGeometry(4.6, 3, 0.3), 0xF3C9D0, 0.65);
      pan.position.set(
        z1.x + ((v % 4) - 1.5) * 7.5,
        z1.y + (v < 4 ? 4.5 : -3.5) + Math.sin(v * 2.1) * 1.2,
        z1.z + Math.sin(v * 1.7) * 4
      );
      pan.rotation.y = (v % 4 - 1.5) * -0.22;
      monde.add(tourne(pan, 0, 0.02 + (v % 3) * 0.008));
    }
    var etoile1 = fil(new THREE.OctahedronGeometry(2.4, 0), 0xE7B84B, 0.9);
    etoile1.position.set(z1.x, z1.y + 0.5, z1.z - 6); monde.add(heros(1, tourne(etoile1, 0.15, 0.25)));

    /* 2 · LE PIPELINE — 4 pylônes + flux de données circulant */
    var pylones = [];
    for (var q = 0; q < 4; q++) {
      var py = fil(new THREE.OctahedronGeometry(2.6, 0), 0x6B9BD1, 0.85);
      py.position.set(z2.x + (q - 1.5) * 13, z2.y + Math.sin(q * 1.9) * 3, z2.z);
      monde.add(heros(2, tourne(py, 0.1 + q * 0.03, 0.18 - q * 0.02)));
      pylones.push(py.position.clone());
    }
    var nF = 160;
    var fluxGeo = new THREE.BufferGeometry();
    fluxGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(nF * 3), 3));
    fluxPts = new THREE.Points(fluxGeo, new THREE.PointsMaterial({
      size: 1.6, map: TEXTURE_POINT, color: 0xFFE9C4, transparent: true,
      opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true
    }));
    fluxPts.frustumCulled = false;
    monde.add(fluxPts);
    for (var f2 = 0; f2 < nF; f2++) fluxData.push({ t: Math.random() * 3, v: 0.35 + Math.random() * 0.5, j: (Math.random() - 0.5) * 1.6 });
    fluxData.chemin = pylones;

    /* 3 · LA FORTERESSE — dôme protecteur + six sentinelles en ronde */
    var dome = fil(new THREE.SphereGeometry(15, 14, 10), 0xE7B84B, 0.35);
    dome.position.copy(z3); monde.add(tourne(dome, 0, 0.03));
    var garde = fil(new THREE.IcosahedronGeometry(3.2, 0), 0xA5384A, 0.9);
    garde.position.copy(z3); monde.add(heros(3, tourne(garde, 0.12, 0.2)));
    for (var s3 = 0; s3 < 6; s3++) {
      var sent = fil(new THREE.OctahedronGeometry(1.2, 0), 0xE7B84B, 0.8);
      var aS = (s3 / 6) * Math.PI * 2;
      sent.position.set(z3.x + Math.cos(aS) * 10, z3.y + Math.sin(aS * 2) * 2, z3.z + Math.sin(aS) * 10);
      monde.add(tourne(sent, 0.3, 0.4));
    }

    /* 4 · LE SYSTÈME — planétarium : un centre, un anneau, six phases en orbite */
    var soleil = fil(new THREE.DodecahedronGeometry(3.4, 0), 0xE7734B, 0.9);
    soleil.position.copy(z4); monde.add(heros(4, tourne(soleil, 0.08, 0.15)));
    var anneau4 = fil(new THREE.TorusGeometry(11, 0.18, 8, 60), 0xF3C9D0, 0.5);
    anneau4.position.copy(z4); anneau4.rotation.x = Math.PI / 2.25; monde.add(anneau4);
    for (var o4 = 0; o4 < 6; o4++) {
      var pl = fil(new THREE.SphereGeometry(1.15, 8, 6), 0xF3C9D0, 0.85);
      monde.add(pl);
      orbiteurs.push({ o: pl, centre: z4, ray: 7.5 + o4 * 1.5, ang: (o4 / 6) * Math.PI * 2, v: 0.35 - o4 * 0.04, incl: o4 * 0.3 });
    }

    /* 5 · LE CŒUR — l'astre final (siège de la supernova) + couronne */
    coeur = fil(new THREE.IcosahedronGeometry(6, 1), 0xE7B84B, 0.75);
    coeur.position.copy(z5);
    monde.add(coeur);
    var halo = fil(new THREE.IcosahedronGeometry(6.4, 1), 0xA5384A, 0.25);
    coeur.add(halo);
    var couronne = fil(new THREE.TorusGeometry(12, 0.2, 8, 70), 0xE7B84B, 0.4);
    couronne.position.copy(z5); couronne.rotation.x = 0.9; monde.add(heros(5, tourne(couronne, 0.01, 0.04)));

    /* la ronde finale : six astres cachés qui n'apparaissent qu'à la supernova */
    for (var r5 = 0; r5 < 6; r5++) {
      var astre = fil(new THREE.OctahedronGeometry(1.6, 0), 0xFFD98A, 0.9);
      astre.visible = false; monde.add(astre);
      ronde.push(astre);
    }

    /* Météores épars entre les mondes (le voyage croise des choses) */
    for (var m5 = 0; m5 < 16; m5++) {
      var met = fil(new THREE.TetrahedronGeometry(0.9 + Math.random() * 1.6, 0),
                    m5 % 3 ? 0xA5384A : 0xE7B84B, 0.55);
      var tPath = Math.random() * 5;
      var iA = Math.floor(tPath), fA = tPath - iA;
      var pA = ZONES[iA].clone().lerp(ZONES[Math.min(iA + 1, 5)], fA);
      met.position.set(pA.x + (Math.random() - 0.5) * 70, pA.y + (Math.random() - 0.5) * 50, pA.z + (Math.random() - 0.5) * 40);
      monde.add(tourne(met, 0.2 + Math.random() * 0.3, 0.15 + Math.random() * 0.3));
    }

    /* ---- Marques MODÉLISÉES en 3D, vraies couleurs (aucun fichier logo) ---- */
    if (global.POLICE_3D) {
      try { police3D = new THREE.Font(global.POLICE_3D); } catch (eF) { police3D = null; }
    }
    if (police3D) {
      /* LEARNWITHUS — lettres PLEINES ivoire-or, tranches cuivrées, halo doré */
      var marque0 = texteVolume('LEARNWITHUS', 2.4, 0xFFE9C4, 0xC9862F);
      if (marque0) {
        haloLumineux(marque0, 0xE7B84B, 30, 8, 0.32);
        marque0.position.set(z0.x, z0.y - 13.5, z0.z + 2);
        monde.add(flotte(heros(0, marque0), 0.7, 0.5));
      }
      /* LEARNWITHUS du final — or incandescent, tranches bordeaux, halo chaud */
      marqueFin = texteVolume('LEARNWITHUS', 2.1, 0xFFD98A, 0xA5384A);
      if (marqueFin) {
        haloLumineux(marqueFin, 0xE7B84B, 27, 7, 0.35);
        marqueFin.position.set(z5.x, z5.y + 11.5, z5.z - 7);
        monde.add(flotte(heros(5, marqueFin), 0.8, 0.4));
      }

      /* LOGO SAP — plaque bleue au flanc droit incliné, lettres blanches penchées */
      var gSAP = new THREE.Group();
      var formeSAP = new THREE.Shape();
      var wS = 9.2, hS = 3.6, pente = 2.6;
      formeSAP.moveTo(-wS / 2, -hS / 2);
      formeSAP.lineTo(wS / 2, -hS / 2);
      formeSAP.lineTo(wS / 2 - pente, hS / 2);
      formeSAP.lineTo(-wS / 2, hS / 2);
      formeSAP.closePath();
      var plaque = plein(new THREE.ExtrudeGeometry(formeSAP, { depth: 0.5, bevelEnabled: false }), 0x0A8AD6);
      gSAP.add(plaque);
      var lettresSAP = texteVolume('SAP', 1.7, 0xFFFFFF, 0xBFE0F5);
      if (lettresSAP) {
        var cisaille = new THREE.Matrix4();
        cisaille.set(1, 0.24, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1);
        lettresSAP.geometry.applyMatrix4(cisaille);   /* l'italique du logo */
        lettresSAP.position.set(-1.0, 0, 0.62);
        gSAP.add(lettresSAP);
      }
      haloLumineux(gSAP, 0x2FA8F0, 15, 7, 0.25);
      gSAP.position.set(z1.x - 15.5, z1.y + 15, z1.z + 1);
      gSAP.rotation.y = 0.18;
      monde.add(flotte(heros(1, gSAP), 0.8, 0.6));

      /* LOGO ANTHROPIC — le grand « A » argile et le mot ivoire */
      var gANT = new THREE.Group();
      var marqueA = texteVolume('A', 2.9, 0xCC785C, 0x8F4A36);
      if (marqueA) { marqueA.position.set(0, 0.7, 0); gANT.add(marqueA); }
      var motANT = texteVolume('ANTHROPIC', 0.66, 0xF0EEE6, 0xCC785C);
      if (motANT) { motANT.position.set(0, -1.9, 0); gANT.add(motANT); }
      haloLumineux(gANT, 0xCC785C, 12, 9, 0.25);
      gANT.position.set(z1.x + 15, z1.y + 15, z1.z + 1);
      gANT.rotation.y = -0.18;
      monde.add(flotte(heros(1, gANT), 0.8, 0.55));

      /* SCRUM — le mot plein au-dessus du cycle bleu/orange */
      var mSCRUMtxt = texteVolume('SCRUM', 1.35, 0xFFFFFF, 0x0A8AD6);
      if (mSCRUMtxt) {
        mSCRUMtxt.position.set(z1.x, z1.y + 17.6, z1.z);
        monde.add(flotte(mSCRUMtxt, 0.6, 0.5));
      }
    }
    /* le cycle du sprint bleu/orange (fonctionne même sans police) */
    var scrum = cycleScrum(0x009FDA, 0xF26722);
    scrum.position.set(z1.x, z1.y + 13.2, z1.z);
    monde.add(flotte(heros(1, tourne(scrum, 0, 0)), 0.7, 0.6));
    animables.push({ o: scrum, rx: 0, ry: 0 });
    scrum.userData.vrille = true;

    /* Points de vue : devant chaque monde, regard décalé (règle des tiers) */
    for (var w = 0; w < 6; w++) {
      waypoints.push(new THREE.Vector3(ZONES[w].x, ZONES[w].y + 3, ZONES[w].z + 34));
      regards.push(new THREE.Vector3(ZONES[w].x + (w % 2 ? -9 : 9), ZONES[w].y + 2, ZONES[w].z));
      accents.push(new THREE.Color(PALETTE[w]));
    }
  }

  /* ---------- champ d'étoiles le long du chemin ---------- */

  function construireParticules() {
    var n = 2400;
    var pos = new Float32Array(n * 3);
    var col = new Float32Array(n * 3);
    var cA = new THREE.Color('#E7B84B'), cB = new THREE.Color('#A5384A'), cC = new THREE.Color('#F7EEF0');
    for (var i = 0; i < n; i++) {
      var x, y, z;
      if (i % 3 === 0) {
        var zi = ZONES[i % 6];
        x = zi.x + (Math.random() - 0.5) * 90;
        y = zi.y + (Math.random() - 0.5) * 70;
        z = zi.z + (Math.random() - 0.5) * 80;
      } else {
        x = (Math.random() - 0.5) * 240;
        y = (Math.random() - 0.5) * 150;
        z = 40 - Math.random() * 860;
      }
      pos[i * 3] = x; pos[i * 3 + 1] = y; pos[i * 3 + 2] = z;
      var m = Math.random();
      var c = m < 0.5 ? cA.clone().lerp(cC, Math.random()) : cB.clone().lerp(cC, Math.random() * 0.6);
      col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
    }
    var geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    points = new THREE.Points(geo, new THREE.PointsMaterial({
      size: 1.5, map: TEXTURE_POINT, vertexColors: true,
      transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending,
      depthWrite: false, sizeAttenuation: true
    }));
    monde.add(points);

    /* fines constellations près des mondes */
    var segs = [];
    for (var zi2 = 0; zi2 < 6; zi2++) {
      for (var s = 0; s < 60; s++) {
        var base = ZONES[zi2];
        var ax = base.x + (Math.random() - 0.5) * 60, ay = base.y + (Math.random() - 0.5) * 45, az = base.z + (Math.random() - 0.5) * 50;
        segs.push(ax, ay, az, ax + (Math.random() - 0.5) * 14, ay + (Math.random() - 0.5) * 12, az + (Math.random() - 0.5) * 10);
      }
    }
    var lgeo = new THREE.BufferGeometry();
    lgeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(segs), 3));
    lignes = new THREE.LineSegments(lgeo, new THREE.LineBasicMaterial({
      color: 0xA5384A, transparent: true, opacity: 0.14, blending: THREE.AdditiveBlending
    }));
    monde.add(lignes);
  }

  /* ---------- comètes filantes ---------- */

  function creerPoolCometes() {
    for (var c = 0; c < 4; c++) {
      var lgeo = new THREE.BufferGeometry();
      lgeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3));
      var ligne = new THREE.Line(lgeo, new THREE.LineBasicMaterial({
        color: c % 2 ? 0xFFE9C4 : 0xF3C9D0, transparent: true, opacity: 0,
        blending: THREE.AdditiveBlending, depthWrite: false
      }));
      ligne.frustumCulled = false; ligne.visible = false;
      scene.add(ligne);
      cometes.push({ l: ligne, actif: false, t0: 0, dur: 0, pos: new THREE.Vector3(), vel: new THREE.Vector3() });
    }
  }

  function lancerComete() {
    var c = null;
    for (var i = 0; i < cometes.length; i++) if (!cometes[i].actif) { c = cometes[i]; break; }
    if (!c) return;
    c.actif = true; c.t0 = performance.now(); c.dur = 1400 + Math.random() * 900;
    /* naît au-dessus de la zone regardée, file en diagonale */
    c.pos.set(
      camRegardCible.x + (Math.random() - 0.5) * 90,
      camRegardCible.y + 22 + Math.random() * 18,
      camRegardCible.z - 15 - Math.random() * 30
    );
    c.vel.set(-(12 + Math.random() * 14) * (Math.random() < 0.5 ? 1 : -1), -(7 + Math.random() * 6), (Math.random() - 0.5) * 8);
    c.l.visible = true;
  }

  function majCometes(dt) {
    for (var i = 0; i < cometes.length; i++) {
      var c = cometes[i];
      if (!c.actif) continue;
      var p = (performance.now() - c.t0) / c.dur;
      if (p >= 1) { c.actif = false; c.l.visible = false; continue; }
      c.pos.addScaledVector(c.vel, dt);
      var arr = c.l.geometry.attributes.position.array;
      arr[0] = c.pos.x; arr[1] = c.pos.y; arr[2] = c.pos.z;
      arr[3] = c.pos.x - c.vel.x * 0.35; arr[4] = c.pos.y - c.vel.y * 0.35; arr[5] = c.pos.z - c.vel.z * 0.35;
      c.l.geometry.attributes.position.needsUpdate = true;
      c.l.material.opacity = 0.85 * Math.sin(p * Math.PI);
    }
  }

  /* ---------- aurores boréales & lucioles ---------- */

  function construireAurores() {
    for (var i = 0; i < 2; i++) {
      var geo = new THREE.PlaneGeometry(260, 18, 56, 5);
      var mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({
        color: i ? 0xA5384A : 0xE7B84B, transparent: true, opacity: 0.06,
        side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false
      }));
      mesh.position.set(i ? -50 : 45, 58 + i * 20, -230 - i * 260);
      mesh.rotation.x = Math.PI / 2.5;
      monde.add(mesh);
      aurores.push({ m: mesh, ph: i * 2.4 });
    }
  }

  function majAurores(t) {
    for (var i = 0; i < aurores.length; i++) {
      var A = aurores[i];
      var pos = A.m.geometry.attributes.position;
      var arr = pos.array;
      for (var v = 0; v < arr.length; v += 3) {
        arr[v + 2] = Math.sin(arr[v] * 0.045 + t * 0.5 + A.ph) * 5
                   + Math.sin(arr[v + 1] * 0.25 + t * 0.3) * 2;
      }
      pos.needsUpdate = true;
      A.m.material.opacity = 0.05 + Math.sin(t * 0.4 + A.ph) * 0.025;
    }
  }

  function construireLucioles() {
    var n = 36;
    var geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    lucioles = new THREE.Points(geo, new THREE.PointsMaterial({
      size: 1.15, map: TEXTURE_POINT, color: 0xFFE9C4, transparent: true,
      opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true
    }));
    lucioles.frustumCulled = false;
    scene.add(lucioles);
    for (var i = 0; i < n; i++) {
      lucioleData.push({ ang: Math.random() * Math.PI * 2, ray: 8 + Math.random() * 10,
                         sp: 0.25 + Math.random() * 0.5, h: (Math.random() - 0.5) * 9 });
    }
  }

  function majLucioles(dt, t) {
    if (!lucioles) return;
    var arr = lucioles.geometry.attributes.position.array;
    for (var i = 0; i < lucioleData.length; i++) {
      var L = lucioleData[i];
      L.ang += L.sp * dt;
      arr[i * 3] = camRegardCible.x + Math.cos(L.ang) * L.ray;
      arr[i * 3 + 1] = camRegardCible.y + L.h + Math.sin(t * 1.3 + i) * 2.4;
      arr[i * 3 + 2] = camRegardCible.z + Math.sin(L.ang) * L.ray * 0.8;
    }
    lucioles.geometry.attributes.position.needsUpdate = true;
    lucioles.material.opacity = 0.55 + Math.sin(t * 2.6) * 0.3;
  }

  /* ---------- tunnel hyperespace (enfant de la caméra) ---------- */

  function construireTunnel() {
    var n = 240;
    tunnelLignes = [];
    var posArr = new Float32Array(n * 6);
    for (var i = 0; i < n; i++) {
      tunnelLignes.push({ ang: Math.random() * Math.PI * 2, rad: 7 + Math.random() * 22, z: -Math.random() * 180, len: 6 + Math.random() * 14 });
    }
    var geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(posArr, 3));
    tunnel = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({
      color: 0xFFE9C4, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false
    }));
    tunnel.frustumCulled = false;
    camera.add(tunnel);
  }

  function majTunnel(dt, vitesse) {
    var attr = tunnel.geometry.attributes.position;
    var arr = attr.array;
    for (var i = 0; i < tunnelLignes.length; i++) {
      var l = tunnelLignes[i];
      l.z += (60 + vitesse * 340) * dt;
      if (l.z > 6) { l.z = -180 - Math.random() * 40; l.ang = Math.random() * Math.PI * 2; l.rad = 7 + Math.random() * 22; }
      var x = Math.cos(l.ang) * l.rad, y = Math.sin(l.ang) * l.rad;
      var etire = l.len * (0.4 + vitesse * 2.2);
      arr[i * 6] = x; arr[i * 6 + 1] = y; arr[i * 6 + 2] = l.z;
      arr[i * 6 + 3] = x; arr[i * 6 + 4] = y; arr[i * 6 + 5] = l.z - etire;
    }
    attr.needsUpdate = true;
    tunnel.material.opacity = Math.min(0.85, vitesse * 1.1);
    tunnel.rotation.z += dt * (0.6 + vitesse * 2.4);
  }

  /* ---------- ondes de choc & gerbes ---------- */

  function creerOnde(position, couleur, maxScale, dur, opa) {
    var m = new THREE.Mesh(
      new THREE.RingGeometry(0.9, 1.25, 64),
      new THREE.MeshBasicMaterial({ color: couleur || 0xE7B84B, transparent: true, opacity: (opa || 0.9), side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false })
    );
    m.position.copy(position);
    scene.add(m);
    ondes.push({ mesh: m, depart: performance.now(), dur: dur || 1100, maxScale: maxScale || 34, opa: (opa || 0.9) });
  }

  function majOndes() {
    for (var i = ondes.length - 1; i >= 0; i--) {
      var o = ondes[i];
      var p = (performance.now() - o.depart) / o.dur;
      if (p >= 1) { scene.remove(o.mesh); o.mesh.geometry.dispose(); o.mesh.material.dispose(); ondes.splice(i, 1); continue; }
      var k = 1 - Math.pow(1 - p, 3);
      o.mesh.scale.setScalar(1 + k * o.maxScale);
      o.mesh.material.opacity = (o.opa || 0.9) * (1 - p);
      o.mesh.lookAt(camera.position);
    }
  }

  function creerPoolBursts() {
    for (var s = 0; s < 6; s++) {
      var cap = 320;
      var geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(cap * 3), 3));
      var pts = new THREE.Points(geo, new THREE.PointsMaterial({
        size: 2.2, map: TEXTURE_POINT, transparent: true, opacity: 0,
        color: 0xE7B84B, blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true
      }));
      pts.frustumCulled = false; pts.visible = false;
      scene.add(pts);
      bursts.push({ mesh: pts, vel: new Float32Array(cap * 3), cap: cap, actif: false, depart: 0, dur: 2400, n: 0 });
    }
  }

  function gerbe(position, couleurHex, nb, vitesse, duree, mode) {
    var b = null;
    for (var i = 0; i < bursts.length; i++) if (!bursts[i].actif) { b = bursts[i]; break; }
    if (!b) return;
    b.actif = true; b.depart = performance.now(); b.dur = duree || 2400;
    b.n = Math.min(nb || 120, b.cap);
    b.mesh.material.color.set(couleurHex || 0xE7B84B);
    var arr = b.mesh.geometry.attributes.position.array;
    for (var j = 0; j < b.n; j++) {
      arr[j * 3] = position.x + (mode === 'pluie' ? (Math.random() - 0.5) * 26 : 0);
      arr[j * 3 + 1] = position.y; arr[j * 3 + 2] = position.z + (mode === 'pluie' ? (Math.random() - 0.5) * 20 : 0);
      if (mode === 'pluie') {
        /* pluie d'or : retombée lente et scintillante */
        b.vel[j * 3] = (Math.random() - 0.5) * 3;
        b.vel[j * 3 + 1] = -(1.5 + Math.random() * 3.5);
        b.vel[j * 3 + 2] = (Math.random() - 0.5) * 3;
      } else {
        var th = Math.random() * Math.PI * 2, ph = Math.acos(Math.random() * 2 - 1);
        var v = (vitesse || 14) * (0.35 + Math.random() * 0.65);
        b.vel[j * 3] = Math.sin(ph) * Math.cos(th) * v;
        b.vel[j * 3 + 1] = Math.sin(ph) * Math.sin(th) * v;
        b.vel[j * 3 + 2] = Math.cos(ph) * v;
      }
    }
    b.mesh.geometry.setDrawRange(0, b.n);
    b.mesh.geometry.attributes.position.needsUpdate = true;
    b.mesh.visible = true;
    b.mesh.material.opacity = 1;
  }

  function majBursts(dt) {
    for (var i = 0; i < bursts.length; i++) {
      var b = bursts[i];
      if (!b.actif) continue;
      var p = (performance.now() - b.depart) / b.dur;
      if (p >= 1) { b.actif = false; b.mesh.visible = false; continue; }
      var arr = b.mesh.geometry.attributes.position.array;
      for (var j = 0; j < b.n; j++) {
        arr[j * 3] += b.vel[j * 3] * dt;
        arr[j * 3 + 1] += b.vel[j * 3 + 1] * dt - 2.2 * dt * p;
        arr[j * 3 + 2] += b.vel[j * 3 + 2] * dt;
        b.vel[j * 3] *= 0.985; b.vel[j * 3 + 1] *= 0.985; b.vel[j * 3 + 2] *= 0.985;
      }
      b.mesh.geometry.attributes.position.needsUpdate = true;
      b.mesh.material.opacity = 1 - p;
      b.mesh.material.size = 2.2 * (1 + p * 0.8);
    }
  }

  /* ---------- API ---------- */

  var API = {
    init: function (canvas) {
      TEXTURE_POINT = spriteRond();
      scene = new THREE.Scene();
      scene.fog = new THREE.FogExp2(0x120809, 0.0062);
      camera = new THREE.PerspectiveCamera(FOV_BASE, innerWidth / innerHeight, 0.1, 500);
      camera.position.set(0, 0, 30);
      scene.add(camera);

      renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, alpha: true });
      renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
      renderer.setSize(innerWidth, innerHeight);
      renderer.setClearColor(0x000000, 0);

      monde = new THREE.Group(); scene.add(monde);
      construireZones();
      construireParticules();
      construireTunnel();
      creerPoolBursts();
      creerPoolCometes();
      construireAurores();
      construireLucioles();

      camPos = camera.position.clone();
      camRegard = new THREE.Vector3(0, 0, -10);
      camPosCible = camPos.clone();
      camRegardCible = camRegard.clone();

      /* noyau incandescent au centre du cœur : la source physique des god rays */
      soleilCoeur = new THREE.Mesh(
        new THREE.SphereGeometry(2.4, 18, 14),
        new THREE.MeshBasicMaterial({ color: 0xFFE9C4, transparent: true, opacity: 0.65 })
      );
      soleilCoeur.position.copy(coeur.position);
      scene.add(soleilCoeur);

      try {
        if (global.POSTPROCESSING) {
          /* pipeline pmndrs/postprocessing : bloom + GOD RAYS + aberration */
          var PP = global.POSTPROCESSING;
          composer = new PP.EffectComposer(renderer);
          composer.addPass(new PP.RenderPass(scene, camera));
          bloomFX = new PP.BloomEffect({ intensity: 0.85, luminanceThreshold: 0.25, luminanceSmoothing: 0.55 });
          rayons = new PP.GodRaysEffect(camera, soleilCoeur, {
            density: 0.94, decay: 0.92, weight: 0.28, exposure: 0.55, samples: 48, clampMax: 1.0
          });
          aberration = new PP.ChromaticAberrationEffect({ offset: new THREE.Vector2(0, 0) });
          composer.addPass(new PP.EffectPass(camera, bloomFX, rayons, aberration));
          /* shim : tout le code existant continue de piloter bloom.strength */
          bloom = { get strength() { return bloomFX.intensity; }, set strength(v) { bloomFX.intensity = v; } };
        } else if (THREE.EffectComposer && THREE.UnrealBloomPass) {
          composer = new THREE.EffectComposer(renderer);
          composer.addPass(new THREE.RenderPass(scene, camera));
          bloom = new THREE.UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.85, 0.6, 0.2);
          composer.addPass(bloom);
        }
      } catch (e) { console.warn('postprocessing indisponible', e); composer = null; }

      horloge = new THREE.Clock();
      window.addEventListener('mousemove', function (e) {
        cibleSouris.x = (e.clientX / innerWidth - 0.5);
        cibleSouris.y = (e.clientY / innerHeight - 0.5);
      });
      window.addEventListener('resize', API.resize);
      document.addEventListener('visibilitychange', function () { actif = !document.hidden; if (actif) boucle(); });
      boucle();
    },

    resize: function () {
      if (!renderer) return;
      camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
      renderer.setSize(innerWidth, innerHeight);
      if (composer) composer.setSize(innerWidth, innerHeight);
    },

    goToChapitre: function (idx) {
      idx = Math.max(0, Math.min(waypoints.length - 1, idx));
      camPosCible.copy(waypoints[idx]);
      camRegardCible.copy(regards[idx]);
      accentCible.copy(accents[idx]);
    },

    kick: function (dir) { kick.x += dir * 2.2; kick.z += 1.1; },

    /* Voyage :
       - intra-acte  : petit déplacement en orbite autour du monde (1,05 s)
       - INTER-ACTE  : vraie traversée de l'espace entre deux mondes
                       (2,2 s, arc large, le monde suivant émerge du fond) */
    voyage: function (chap, posDansActe, dir, style, interActe) {
      if (finale.actif) return;
      chap = Math.max(0, Math.min(waypoints.length - 1, chap));
      var wp = waypoints[chap];
      accentCible.copy(accents[chap]);
      camRegardCible.copy(regards[chap]);

      var ang = posDansActe * 0.75 * (posDansActe % 2 ? 1 : -1);
      var ray = 5 + (posDansActe % 3) * 3.5;
      var vers = new THREE.Vector3(
        wp.x + Math.sin(ang) * ray,
        wp.y + ((posDansActe % 3) - 1) * 3.5,
        wp.z + Math.cos(ang) * 2.5 + (posDansActe % 2) * 3
      );

      var de = camPos.clone();
      var ctrl = de.clone().lerp(vers, 0.5);
      var st = ((style % 6) + 6) % 6;
      var amp = interActe ? 2.6 : 1;          /* la traversée amplifie tout */
      var roll = dir * 0.12, fovAmp = 10;
      if (st === 0) { ctrl.x += dir * 30 * amp; fovAmp = 12; }
      if (st === 1) { ctrl.y += 24 * amp; roll = dir * 0.2; fovAmp = 16; }
      if (st === 2) { ctrl.x -= dir * 18 * amp; ctrl.y -= 15 * amp; roll = dir * 0.55; fovAmp = 8; }
      if (st === 3) { ctrl.z += 32 * amp; fovAmp = -15; }
      if (st === 4) {
        var lat = new THREE.Vector3().subVectors(vers, de).cross(new THREE.Vector3(0, 1, 0)).normalize();
        ctrl.addScaledVector(lat, dir * 28 * amp); ctrl.y += 6 * amp; roll = dir * 0.3; fovAmp = 9;
      }
      if (st === 5) { ctrl.y += 32 * amp; ctrl.z -= 12 * amp; roll = -dir * 0.34; fovAmp = 18; }
      if (interActe) { fovAmp = Math.max(fovAmp, 16); roll *= 1.3; }

      trajet.actif = true;
      trajet.depart = performance.now();
      trajet.duree = interActe ? 2200 : 1050;
      trajet.courbe = new THREE.QuadraticBezierCurve3(de, ctrl, vers);
      trajet.roll = roll;
      trajet.fovAmp = fovAmp;
      trajet.gerbeFaite = false;
      trajet.hyper = !!interActe;      /* la traversée rallume le tunnel */
      trajet.chap = chap;
      camPosCible.copy(vers);
    },

    warpIntro: function (dureeMs, onDone) {
      camPos.set(0, 10, 190);
      camRegard.set(0, 0, -40);
      camPosCible.copy(waypoints[0]);
      camRegardCible.copy(regards[0]);
      warp.actif = true;
      warp.depart = performance.now();
      warp.duree = dureeMs || 2600;
      warp.de = camPos.clone();
      warp.vers = waypoints[0].clone();
      /* trajectoire en S : la caméra SLALOME jusqu'au portail */
      warp.courbe = new THREE.QuadraticBezierCurve3(
        warp.de.clone(),
        new THREE.Vector3(58, 36, 85),
        warp.vers.clone()
      );
      warp.fin = onDone;
      warp.j1 = false; warp.j2 = false; warp.lastSpark = 0;
    },

    finale: function (onExplosion) {
      if (finale.actif) return;
      finale.actif = true;
      finale.depart = performance.now();
      finale.explose = false;
      finale.cb = onExplosion || null;
      trajet.actif = false;
      camRegardCible.copy(coeur.position);
    }
  };

  /* ---------- boucle ---------- */

  function boucle() {
    if (!actif) return;
    requestAnimationFrame(boucle);
    var dt = Math.min(horloge.getDelta(), 0.05), t = horloge.getElapsedTime();

    souris.x += (cibleSouris.x - souris.x) * 0.04;
    souris.y += (cibleSouris.y - souris.y) * 0.04;

    var rollFrame = 0;
    var fovCible = FOV_BASE;

    if (warp.actif) {
      var p = Math.min(1, (performance.now() - warp.depart) / warp.duree);
      var k = easeVol ? easeVol(p) : easeWarp(p);
      var vitesse = Math.sin(p * Math.PI);
      camPos.copy(warp.courbe.getPoint(k));
      camPos.x += (Math.random() - 0.5) * vitesse * 1.1;
      camPos.y += (Math.random() - 0.5) * vitesse * 1.1;
      /* pluie d'étincelles qu'on TRAVERSE en plein vol */
      if (p > 0.12 && p < 0.88 && performance.now() - warp.lastSpark > 230) {
        warp.lastSpark = performance.now();
        var devant = warp.courbe.getPoint(Math.min(1, k + 0.10));
        gerbe(devant.clone().add(new THREE.Vector3((Math.random() - 0.5) * 24, (Math.random() - 0.5) * 18, 0)),
              Math.random() < 0.5 ? 0xFFD98A : 0xF3C9D0, 36, 7, 650);
      }
      /* la teinte du tunnel vire de l'or au rose pendant la traversée */
      tunnel.material.color.setHex(0xFFE9C4).lerp(new THREE.Color(0xF3C9D0), p);
      camRegard.lerp(camRegardCible, 0.08);
      if (points) points.material.size = 1.5 + vitesse * 1.0;
      if (lignes) lignes.material.opacity = 0.14 + vitesse * 0.34;
      if (bloom) bloom.strength = 0.8 + vitesse * 1.0;
      scene.fog.density = 0.0062 - vitesse * 0.003;
      majTunnel(dt, vitesse);
      if (aberration) aberration.offset.set(vitesse * 0.0022, vitesse * 0.0013);
      rollFrame = Math.PI * 2 * easeInOut(p);
      fovCible = FOV_BASE + vitesse * 26;
      if (p > 0.4 && !warp.j1) { warp.j1 = true; creerOnde(camPos.clone().lerp(warp.vers, 0.5), 0xE7B84B, 16, 650, 0.4); }
      if (p > 0.7 && !warp.j2) { warp.j2 = true; creerOnde(camPos.clone().lerp(warp.vers, 0.65), 0xF3C9D0, 20, 700, 0.4); }
      if (p >= 1) {
        warp.actif = false;
        if (points) points.material.size = 1.5;
        if (lignes) lignes.material.opacity = 0.14;
        scene.fog.density = 0.0062;
        tunnel.material.opacity = 0;
        creerOnde(camRegard.clone(), 0xE7B84B, 40, 1200);
        var cAr = camRegard.clone();
        setTimeout(function () { creerOnde(cAr, 0xF3C9D0, 58, 950); }, 150);
        gerbe(camRegard.clone().add(new THREE.Vector3(18, -8, 0)), 0xFFD98A, 130, 24, 1500);
        gerbe(camRegard.clone().add(new THREE.Vector3(-16, 10, 4)), 0xF3C9D0, 90, 16, 1300);
        if (warp.fin) { var f = warp.fin; warp.fin = null; f(); }
      }
    } else if (finale.actif) {
      var pf = performance.now() - finale.depart;
      var centre = coeur.position.clone();
      if (pf < 950) {
        var pc = pf / 950;
        var s = 1 + pc * 1.9 + Math.sin(pf * 0.05) * 0.12 * pc;
        coeur.scale.setScalar(s);
        kick.x += (Math.random() - 0.5) * pc * 1.1;
        if (bloom) bloom.strength = 0.9 + pc * 1.6;
        camPosCible.set(centre.x, centre.y + 4, centre.z + 46);
        camRegardCible.copy(centre);
        camPos.lerp(camPosCible, 0.06);
        camRegard.lerp(camRegardCible, 0.1);
      } else {
        if (!finale.explose) {
          finale.explose = true;
          if (finale.cb) { var cbf = finale.cb; finale.cb = null; cbf(); }
          gerbe(centre, 0xFFD98A, 320, 26, 3200);
          gerbe(centre, 0xE7734B, 300, 19, 3600);
          gerbe(centre, 0xE7B84B, 280, 13, 4000);
          creerOnde(centre, 0xE7B84B, 55, 1400);
          (function (c2) {
            setTimeout(function () { creerOnde(c2, 0xF3C9D0, 70, 1600); }, 180);
            setTimeout(function () { creerOnde(c2, 0xA5384A, 85, 1800); }, 380);
            setTimeout(function () { gerbe(c2.clone().add(new THREE.Vector3(14, 8, 0)), 0xFFE9C4, 150, 15, 2500); }, 600);
            setTimeout(function () { gerbe(c2.clone().add(new THREE.Vector3(-16, -6, 4)), 0xFFD98A, 150, 15, 2500); }, 950);
            setTimeout(function () { gerbe(c2.clone().add(new THREE.Vector3(0, 12, -6)), 0xE7734B, 130, 17, 2400); }, 1400);
            /* le bouquet continue : 8 fusées synchronisées avec les
               crépitements de l'apothéose audio (1,25 s → 4 s) */
            for (var kx = 0; kx < 8; kx++) {
              (function (kx) {
                setTimeout(function () {
                  gerbe(c2.clone().add(new THREE.Vector3((Math.random() - 0.5) * 32, (Math.random() - 0.3) * 24, (Math.random() - 0.5) * 26)),
                        [0xFFD98A, 0xE7734B, 0xF3C9D0, 0xFFE9C4][kx % 4], 110, 13, 2200);
                }, 1250 + kx * 340);
              })(kx);
            }
            /* et la pluie d'or qui retombe sur la scène */
            setTimeout(function () { gerbe(c2.clone().add(new THREE.Vector3(0, 24, 0)), 0xFFE9C4, 240, 4, 6200, 'pluie'); }, 2100);
          })(centre.clone());
          coeur.scale.setScalar(0.5);
          ronde.forEach(function (a) { a.visible = true; a.position.copy(centre); });
          kick.x += 3;
          /* GOD RAYS : les rayons divins jaillissent du cœur à l'explosion */
          if (soleilCoeur) soleilCoeur.material.opacity = 1;
          try {
            if (rayons && typeof gsap !== 'undefined') {
              var u = rayons.godRaysMaterial.uniforms;
              gsap.fromTo(u.weight, { value: 0.85 }, { value: 0.30, duration: 4.5, ease: 'power2.out' });
              gsap.fromTo(u.exposure, { value: 0.95 }, { value: 0.55, duration: 4.5, ease: 'power2.out' });
            }
            if (typeof gsap !== 'undefined') {
              gsap.fromTo(fovPunch, { v: 17 }, { v: 0, duration: 1.3, ease: 'expo.out' });
            }
          } catch (eG) {}
        }
        var po = (pf - 950) / (finale.duree - 950);
        var sc = 0.5 + Math.min(1, po * 2) * 0.9 + Math.sin(pf * 0.01) * 0.1;
        coeur.scale.setScalar(sc);
        if (bloom) bloom.strength = Math.max(1.0, 2.8 - po * 1.6);
        var angO = po * Math.PI * 1.4;
        var rayO = 42 - po * 9;   /* rapprochement final */
        camPosCible.set(centre.x + Math.sin(angO) * rayO, centre.y + 6 + Math.sin(po * Math.PI) * 8, centre.z + Math.cos(angO) * rayO);
        camRegardCible.copy(centre);
        camPos.lerp(camPosCible, 0.035);
        camRegard.lerp(camRegardCible, 0.08);
        for (var ri = 0; ri < ronde.length; ri++) {
          var aR = (ri / 6) * Math.PI * 2 + pf * 0.0011;
          var cible = new THREE.Vector3(centre.x + Math.cos(aR) * 15, centre.y + Math.sin(aR * 1.4) * 5, centre.z + Math.sin(aR) * 15);
          ronde[ri].position.lerp(cible, 0.05);
          ronde[ri].rotation.x += dt * 1.8; ronde[ri].rotation.y += dt * 2.2;
        }
        if (po >= 1) { finale.actif = false; if (bloom) bloom.strength = 0.85; }
      }
    } else if (trajet.actif) {
      var pt2 = Math.min(1, (performance.now() - trajet.depart) / trajet.duree);
      var kt = easeTraj ? easeTraj(pt2) : easeWarp(pt2);
      var vit = Math.sin(pt2 * Math.PI);
      camPos.copy(trajet.courbe.getPoint(kt));
      camRegard.lerp(camRegardCible, 0.10);
      if (points) points.material.size = 1.5 + vit * 0.7;
      if (bloom) bloom.strength = 0.85 + vit * 0.35;
      fovCible = FOV_BASE + trajet.fovAmp * vit;
      rollFrame = trajet.roll * Math.sin(Math.PI * pt2);
      if (trajet.hyper) majTunnel(dt, vit * 0.8);   /* mini-hyperespace de traversée */
      if (pt2 > 0.88 && !trajet.gerbeFaite) {
        trajet.gerbeFaite = true;
        gerbe(camRegardCible.clone().add(new THREE.Vector3(14, -9, 3)), accentCible.getHex(), 60, 8, 900);
        if (trajet.hyper) {
          creerOnde(camRegardCible.clone(), accentCible.getHex(), 24, 850);
          pulseZone.chap = trajet.chap; pulseZone.t0 = performance.now();
        }
      }
      if (pt2 >= 1) {
        trajet.actif = false;
        if (points) points.material.size = 1.5;
        if (trajet.hyper) { tunnel.material.opacity = 0; trajet.hyper = false; }
      }
    } else {
      camPos.lerp(camPosCible, 0.03);
      camRegard.lerp(camRegardCible, 0.03);
    }
    if (aberration && !warp.actif) aberration.offset.multiplyScalar(0.9);

    kick.x *= 0.90; kick.z *= 0.90;

    camera.position.copy(camPos);
    camera.position.x += souris.x * 6 + kick.x;
    camera.position.y += -souris.y * 4;
    camera.position.z += kick.z;
    camera.lookAt(camRegard);
    if (rollFrame) camera.rotation.z += rollFrame;
    /* le nom de la marque ne se lit jamais à l'envers pendant la ronde */
    if (finale.actif && marqueFin) marqueFin.lookAt(camera.position);

    camera.fov += (fovCible + fovPunch.v - camera.fov) * 0.12;
    camera.updateProjectionMatrix();

    /* comètes filantes (jamais pendant warp/finale : la scène est déjà pleine) */
    if (!warp.actif && !finale.actif && t > prochaineComete) {
      prochaineComete = t + 3 + Math.random() * 4.5;
      lancerComete();
    }
    majCometes(dt);

    /* scintillement doux des étoiles au repos */
    if (!warp.actif && !trajet.actif && !finale.actif && points) {
      points.material.opacity = 0.82 + Math.sin(t * 2.1) * 0.09;
    }

    majAurores(t);
    majLucioles(dt, t);

    /* lévitation douce des objets-marques */
    for (var fl = 0; fl < flotteurs.length; fl++) {
      var F = flotteurs[fl];
      F.o.position.y = F.y0 + Math.sin(t * F.sp + F.ph) * F.amp;
      if (F.o.userData.vrille) F.o.rotation.z = t * 0.5;   /* le sprint tourne */
    }

    /* le monde "salue" quand on arrive chez lui (pulse 750 ms) */
    if (pulseZone.chap >= 0) {
      var pz = (performance.now() - pulseZone.t0) / 750;
      if (pz >= 1) {
        zoneHeros[pulseZone.chap].forEach(function (h) { h.scale.setScalar(1); });
        pulseZone.chap = -1;
      } else {
        var sz = 1 + 0.16 * Math.sin(Math.PI * pz);
        zoneHeros[pulseZone.chap].forEach(function (h) { h.scale.setScalar(sz); });
      }
    }

    /* la vie des mondes */
    for (var a2 = 0; a2 < animables.length; a2++) {
      var an = animables[a2];
      an.o.rotation.x += an.rx * dt; an.o.rotation.y += an.ry * dt;
    }
    /* le flux de données circule entre les pylônes */
    if (fluxPts) {
      var chemin = fluxData.chemin;
      var fa = fluxPts.geometry.attributes.position.array;
      for (var f3 = 0; f3 < fluxData.length; f3++) {
        var d3 = fluxData[f3];
        d3.t += d3.v * dt;
        if (d3.t >= 3) d3.t -= 3;
        var seg = Math.floor(d3.t), fr = d3.t - seg;
        var pA2 = chemin[seg], pB2 = chemin[seg + 1];
        fa[f3 * 3] = pA2.x + (pB2.x - pA2.x) * fr;
        fa[f3 * 3 + 1] = pA2.y + (pB2.y - pA2.y) * fr + Math.sin(d3.t * 6 + f3) * 0.8 + d3.j;
        fa[f3 * 3 + 2] = pA2.z + (pB2.z - pA2.z) * fr;
      }
      fluxPts.geometry.attributes.position.needsUpdate = true;
    }
    /* les planètes du système orbital */
    for (var ob = 0; ob < orbiteurs.length; ob++) {
      var oo = orbiteurs[ob];
      oo.ang += oo.v * dt;
      oo.o.position.set(
        oo.centre.x + Math.cos(oo.ang) * oo.ray,
        oo.centre.y + Math.sin(oo.ang) * Math.sin(oo.incl) * 3,
        oo.centre.z + Math.sin(oo.ang) * oo.ray * 0.8
      );
    }
    if (soleilCoeur) {
      soleilCoeur.scale.setScalar(coeur.scale.x * (finale.actif ? 1.25 : 0.95));
      if (!finale.actif) soleilCoeur.material.opacity = 0.6 + Math.sin(t * 1.6) * 0.1;
    }
    if (coeur && !finale.actif) {
      coeur.rotation.x = t * 0.15; coeur.rotation.y = t * 0.2;
      if (!warp.actif && !trajet.actif) {
        var s2 = 1 + Math.sin(t * 1.6) * 0.06;
        coeur.scale.setScalar(coeur.scale.x + (s2 - coeur.scale.x) * 0.05);
      }
    } else if (coeur) {
      coeur.rotation.x += dt * 0.8; coeur.rotation.y += dt * 1.2;
    }

    accentCourant.lerp(accentCible, 0.03);
    if (coeur) coeur.material.color.copy(accentCourant);
    if (bloom && !warp.actif && !trajet.actif && !finale.actif) {
      bloom.strength += (0.78 + Math.sin(t * 1.6) * 0.08 - bloom.strength) * 0.06;
    }

    majOndes();
    majBursts(dt);

    if (composer) composer.render(dt); else renderer.render(scene, camera);
  }

  global.Scene3D = API;
})(window);
