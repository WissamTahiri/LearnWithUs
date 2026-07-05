/* =============================================================
   AudioFX — moteur sonore 100 % génératif (Web Audio API)
   Aucun fichier audio, aucune dépendance, fonctionne hors-ligne.
   Inspiré du sound design de la présentation de référence :
   partition en ré pentatonique mineur (D F G A C), nappe cosmique
   permanente, whoosh de transition, arpèges à l'avancée, bouquet final.
   ============================================================= */
(function (global) {
  'use strict';

  // Ré pentatonique mineur sur plusieurs octaves
  var N = {
    D2: 73.42, A2: 110.0, C3: 130.81, D3: 146.83, F3: 174.61, G3: 196.0,
    A3: 220.0, C4: 261.63, D4: 293.66, F4: 349.23, G4: 392.0, A4: 440.0,
    C5: 523.25, D5: 587.33, F5: 698.46, G5: 783.99, A5: 880.0, C6: 1046.5, D6: 1174.66
  };
  var GAMME = [N.D3, N.F3, N.G3, N.A3, N.C4, N.D4, N.F4, N.G4, N.A4, N.C5, N.D5];

  var ctx = null, master = null, busMusic = null, busFx = null, busAir = null, reverb = null;
  var padGain = null, padOsc = [];
  var muted = localStorage.getItem('lwu-muted') === '1';
  var started = false;
  var muteCbs = [];

  function reverbIR(seconds, decay) {
    var rate = ctx.sampleRate, len = Math.floor(rate * seconds);
    var buf = ctx.createBuffer(2, len, rate);
    for (var ch = 0; ch < 2; ch++) {
      var d = buf.getChannelData(ch);
      for (var i = 0; i < len; i++) {
        d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
      }
    }
    return buf;
  }

  function softClipCurve() {
    var n = 1024, curve = new Float32Array(n);
    for (var i = 0; i < n; i++) {
      var x = (i / (n - 1)) * 2 - 1;
      curve[i] = Math.tanh(x * 1.4);
    }
    return curve;
  }

  function build() {
    var AC = global.AudioContext || global.webkitAudioContext;
    ctx = new AC();

    master = ctx.createGain();
    master.gain.value = muted ? 0.0001 : 0.9;

    var shaper = ctx.createWaveShaper();
    shaper.curve = softClipCurve();
    var comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14; comp.ratio.value = 3; comp.attack.value = 0.004; comp.release.value = 0.25;

    master.connect(shaper); shaper.connect(comp); comp.connect(ctx.destination);

    reverb = ctx.createConvolver();
    reverb.buffer = reverbIR(3.2, 2.4);
    var reverbGain = ctx.createGain(); reverbGain.gain.value = 0.5;
    reverb.connect(reverbGain); reverbGain.connect(master);

    busMusic = ctx.createGain(); busMusic.gain.value = 0.8;
    busFx = ctx.createGain(); busFx.gain.value = 0.85;
    busAir = ctx.createGain(); busAir.gain.value = 0.6;
    [busMusic, busFx, busAir].forEach(function (b) { b.connect(master); b.connect(reverb); });

    startPad();
  }

  // Nappe d'ambiance permanente (drone doux, filtrée, LFO lent)
  function startPad() {
    padGain = ctx.createGain();
    padGain.gain.value = 0.0001;   /* nappe MUETTE : silence pendant les slides,
                                      le son n'existe que sur les transitions */
    padGain.connect(busAir);

    var filtre = ctx.createBiquadFilter();
    filtre.type = 'lowpass'; filtre.frequency.value = 520; filtre.Q.value = 4;
    filtre.connect(padGain);

    var lfo = ctx.createOscillator(); var lfoGain = ctx.createGain();
    lfo.frequency.value = 0.06; lfoGain.gain.value = 220;
    lfo.connect(lfoGain); lfoGain.connect(filtre.frequency); lfo.start();

    [N.D2, N.A2, N.D3, N.F3].forEach(function (f, i) {
      var o = ctx.createOscillator();
      o.type = i % 2 ? 'triangle' : 'sine';
      o.frequency.value = f;
      o.detune.value = (i - 1.5) * 4;
      var g = ctx.createGain(); g.gain.value = i === 0 ? 0.5 : 0.28;
      o.connect(g); g.connect(filtre); o.start();
      padOsc.push(o);
    });
  }

  // Enveloppe d'une note pluck (pan optionnel : la note a une place dans l'espace)
  function pluck(freq, t, dur, gain, type, bus, pan) {
    if (!isFinite(freq) || !isFinite(t) || !isFinite(dur) || !isFinite(gain) || freq <= 0 || dur <= 0) return;
    try {
      var o = ctx.createOscillator();
      o.type = type || 'triangle';
      o.frequency.value = freq;
      var g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(Math.max(gain, 0.0002), t + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g);
      if (pan && ctx.createStereoPanner) {
        var pn = ctx.createStereoPanner(); pn.pan.value = pan;
        g.connect(pn); pn.connect(bus || busMusic);
      } else {
        g.connect(bus || busMusic);
      }
      o.start(t); o.stop(t + dur + 0.05);
    } catch (e) {}
  }

  function noiseBurst(t, dur, cutoff, gain) {
    if (!isFinite(t) || !isFinite(dur) || dur <= 0 || !isFinite(cutoff)) return;
    try {
    var len = Math.floor(ctx.sampleRate * dur);
    var buf = ctx.createBuffer(1, len, ctx.sampleRate);
    var d = buf.getChannelData(0);
    for (var i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    var src = ctx.createBufferSource(); src.buffer = buf;
    var f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = cutoff; f.Q.value = 0.7;
    var g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(gain, 0.0002), t + 0.05);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f); f.connect(g); g.connect(busFx);
    src.start(t); src.stop(t + dur);
    } catch (e) {}
  }

  /* ===== Silence hors de la page =====
     Dès que l'onglet est masqué ou que la fenêtre perd le focus, le
     contexte audio est SUSPENDU (silence total, zéro CPU). Il reprend
     automatiquement au retour sur la page. */
  function majSuspension() {
    if (!ctx) return;
    var horsPage = document.hidden || !document.hasFocus();
    try {
      if (horsPage) { if (ctx.state === 'running') ctx.suspend(); }
      else { if (ctx.state === 'suspended') ctx.resume(); }
    } catch (e) {}
  }
  document.addEventListener('visibilitychange', majSuspension);
  window.addEventListener('blur', function () { setTimeout(majSuspension, 80); });
  window.addEventListener('focus', majSuspension);
  /* filet : certains navigateurs re-suspendent le contexte — on le
     relance au moindre geste utilisateur */
  document.addEventListener('pointerdown', majSuspension, { passive: true });
  document.addEventListener('keydown', majSuspension, { passive: true });
  window.addEventListener('pagehide', function () { if (ctx) try { ctx.suspend(); } catch (e) {} });

  var api = {
    get ready() { return started; },
    get muted() { return muted; },
    get etat() { return ctx ? ctx.state : 'off'; },

    unlock: function () {
      if (started) return;
      try {
        /* iOS : catégorie 'playback' → le Web Audio ignore l'interrupteur
           sonnerie/silence de l'iPhone (Safari 16.4+, sans effet ailleurs) */
        if (navigator.audioSession) { try { navigator.audioSession.type = 'playback'; } catch (e2) {} }
        build(); started = true;
        if (ctx.state === 'suspended') ctx.resume();
      }
      catch (e) { console.warn('Audio indisponible', e); }
    },

    onMute: function (cb) { muteCbs.push(cb); },
    setMuted: function (v) {
      muted = v; localStorage.setItem('lwu-muted', v ? '1' : '0');
      if (ctx) master.gain.setTargetAtTime(v ? 0.0001 : 0.9, ctx.currentTime, 0.05);
      muteCbs.forEach(function (cb) { cb(v); });
    },
    toggleMute: function () { this.setMuted(!muted); },

    // Whoosh de transition (dir: +1 avance, -1 recule)
    whoosh: function (dir) {
      if (!started) return;
      var t = ctx.currentTime;
      noiseBurst(t, 0.5, dir >= 0 ? 900 : 500, 0.22);
      try {
        // petit sweep
        var o = ctx.createOscillator(); o.type = 'sine';
        var g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t);
        o.frequency.setValueAtTime(dir >= 0 ? 220 : 520, t);
        o.frequency.exponentialRampToValueAtTime(dir >= 0 ? 620 : 180, t + 0.4);
        g.gain.exponentialRampToValueAtTime(0.10, t + 0.06);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.45);
        o.connect(g); g.connect(busFx); o.start(t); o.stop(t + 0.5);
      } catch (e) {}
    },

    // Clic léger
    click: function () {
      if (!started) return;
      pluck(N.A4, ctx.currentTime, 0.09, 0.10, 'sine', busFx);
    },

    /* Battement sub du warp d'ouverture — calé sur les ondes de choc */
    boum: function () {
      if (!started) return;
      pluck(N.D2, ctx.currentTime, 0.9, 0.22, 'sine', busFx);
    },

    /* Shimmer cristallin : la signature sonore de la naissance
       lettre à lettre du titre final (souffle très aigu qui s'éteint) */
    shimmer: function () {
      if (!started) return;
      var t = ctx.currentTime;
      try {
        var len = Math.floor(ctx.sampleRate * 1.2);
        var buf = ctx.createBuffer(1, len, ctx.sampleRate);
        var d = buf.getChannelData(0);
        for (var i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.2);
        var src = ctx.createBufferSource(); src.buffer = buf;
        var f = ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 6000;
        var g = ctx.createGain();
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(0.09, t + 0.06);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 1.2);
        src.connect(f); f.connect(g); g.connect(busFx);
        src.start(t); src.stop(t + 1.25);
      } catch (e) {}
    },

    // Arpège à l'entrée d'un chapitre (motif de 4 notes, teinte selon index)
    arpege: function (idx) {
      if (!started) return;
      var t = ctx.currentTime;
      var base = idx % 3;
      var motif = [GAMME[base], GAMME[base + 2], GAMME[base + 4], GAMME[base + 6]];
      motif.forEach(function (f, i) {
        pluck(f, t + i * 0.10, 0.5, 0.14, i % 2 ? 'triangle' : 'sine', busMusic, (i - 1.5) * 0.25);
        pluck(f * 2, t + i * 0.10 + 0.02, 0.3, 0.05, 'sine', busMusic, (1.5 - i) * 0.25);
      });
    },

    // Chime de validation (accord ascendant brillant)
    chime: function () {
      if (!started) return;
      var t = ctx.currentTime;
      [N.D5, N.F5, N.A5, N.D6].forEach(function (f, i) {
        pluck(f, t + i * 0.06, 0.9, 0.12, 'sine', busMusic);
      });
    },

    /* ===== Sons synchronisés aux animations (v2) ===== */

    /* Lever de rideau soyeux : accord qui s'ouvre (filtre qui s'épanouit),
       glissando de harpe cristallin, souffle d'air léger. Fluide, élégant. */
    ouverture: function () {
      if (!started) return;
      var t = ctx.currentTime;
      try {
        /* accord ré-la-ré qui s'épanouit sur 1,8 s */
        [N.D3, N.A3, N.D4, N.F4].forEach(function (fq, i) {
          var o = ctx.createOscillator(); o.type = i % 2 ? 'triangle' : 'sine';
          o.frequency.value = fq; o.detune.value = (i - 1.5) * 3;
          var f = ctx.createBiquadFilter(); f.type = 'lowpass';
          f.frequency.setValueAtTime(320, t);
          f.frequency.exponentialRampToValueAtTime(3200, t + 1.6);
          var g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t);
          g.gain.exponentialRampToValueAtTime(0.085, t + 0.9);
          g.gain.exponentialRampToValueAtTime(0.0001, t + 2.0);
          o.connect(f); f.connect(g); g.connect(busMusic);
          o.start(t); o.stop(t + 2.1);
        });
        /* harpe cristalline ascendante */
        for (var h = 0; h < 6; h++) {
          pluck(GAMME[3 + h], t + 0.35 + h * 0.09, 0.9, 0.07, 'triangle', busMusic);
        }
        /* souffle d'air très léger */
        noiseBurst(t + 0.2, 1.2, 900, 0.05);
      } catch (e) {}
    },

    /* Riser de warp : monte pendant toute la durée du voyage d'ouverture,
       impact + scintillement pile à l'arrivée. durMs = durée du warp 3D. */
    riser: function (durMs) {
      if (!started) return;
      var dur = (durMs || 2600) / 1000;
      var t = ctx.currentTime;
      try {
        /* souffle qui enfle et monte en fréquence (vent de la traversée) */
        var len = Math.floor(ctx.sampleRate * dur);
        var buf = ctx.createBuffer(1, len, ctx.sampleRate);
        var d = buf.getChannelData(0);
        for (var i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
        var src = ctx.createBufferSource(); src.buffer = buf;
        var f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 1.2;
        f.frequency.setValueAtTime(160, t);
        f.frequency.exponentialRampToValueAtTime(2400, t + dur * 0.85);
        var g = ctx.createGain();
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(0.30, t + dur * 0.7);
        g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        src.connect(f); f.connect(g); g.connect(busFx);
        src.start(t); src.stop(t + dur);

        /* glissando grave → aigu, la "propulsion" */
        var o = ctx.createOscillator(); o.type = 'sawtooth';
        var og = ctx.createGain(); og.gain.setValueAtTime(0.0001, t);
        var of = ctx.createBiquadFilter(); of.type = 'lowpass'; of.frequency.value = 900;
        o.frequency.setValueAtTime(N.D2, t);
        o.frequency.exponentialRampToValueAtTime(N.D4, t + dur * 0.9);
        og.gain.exponentialRampToValueAtTime(0.08, t + dur * 0.5);
        og.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        o.connect(of); of.connect(og); og.connect(busMusic);
        o.start(t); o.stop(t + dur + 0.1);

        /* arrivée : impact grave + accord scintillant (synchro flash) */
        var ta = t + dur;
        var imp = ctx.createOscillator(); imp.type = 'sine';
        var ig = ctx.createGain(); ig.gain.setValueAtTime(0.0001, ta);
        imp.frequency.setValueAtTime(140, ta);
        imp.frequency.exponentialRampToValueAtTime(45, ta + 0.7);
        ig.gain.exponentialRampToValueAtTime(0.32, ta + 0.03);
        ig.gain.exponentialRampToValueAtTime(0.0001, ta + 0.9);
        imp.connect(ig); ig.connect(busFx); imp.start(ta); imp.stop(ta + 1);
        [N.D5, N.A5, N.D6].forEach(function (fq, i2) {
          pluck(fq, ta + 0.05 + i2 * 0.07, 1.1, 0.10, 'sine', busMusic);
        });
      } catch (e) {}
    },

    /* Balayage stéréo : suit le sweep lumineux (gauche → droite, 0,75 s).
       Le son traverse physiquement l'espace comme la lumière l'écran. */
    sweep: function (long) {
      if (!started) return;
      var t = ctx.currentTime, dur = 0.75;
      if (long) {
        try {
          /* queue de souffle : le vol continue après le balayage (4,5 s) */
          var lenQ = Math.floor(ctx.sampleRate * 4.5);
          var bufQ = ctx.createBuffer(1, lenQ, ctx.sampleRate);
          var dQ = bufQ.getChannelData(0);
          for (var iq = 0; iq < lenQ; iq++) dQ[iq] = Math.random() * 2 - 1;
          var srcQ = ctx.createBufferSource(); srcQ.buffer = bufQ;
          var fQ = ctx.createBiquadFilter(); fQ.type = 'lowpass';
          fQ.frequency.setValueAtTime(1400, t + 0.5);
          fQ.frequency.exponentialRampToValueAtTime(240, t + 4.7);
          var gQ = ctx.createGain();
          gQ.gain.setValueAtTime(0.0001, t + 0.4);
          gQ.gain.exponentialRampToValueAtTime(0.10, t + 0.9);
          gQ.gain.exponentialRampToValueAtTime(0.0001, t + 4.75);
          srcQ.connect(fQ); fQ.connect(gQ); gQ.connect(busFx);
          srcQ.start(t + 0.4); srcQ.stop(t + 4.8);
          /* poids cinéma : drone sub (ré grave) sous TOUTE la traversée de 5 s */
          var oD = ctx.createOscillator(); oD.type = 'sine'; oD.frequency.value = 36.7;
          var gD = ctx.createGain();
          gD.gain.setValueAtTime(0.0001, t);
          gD.gain.exponentialRampToValueAtTime(0.07, t + 0.6);
          gD.gain.setValueAtTime(0.07, t + 4.3);
          gD.gain.exponentialRampToValueAtTime(0.0001, t + 5.0);
          oD.connect(gD); gD.connect(busFx); oD.start(t); oD.stop(t + 5.1);
          /* arrivée à 5 s : signature ré→la + impact doux, pile sur l'onde */
          pluck(N.D5, t + 4.75, 0.35, 0.09, 'sine', busMusic);
          pluck(N.A4, t + 4.89, 0.5, 0.09, 'sine', busMusic);
          var oi = ctx.createOscillator(); oi.type = 'sine';
          var gi = ctx.createGain(); gi.gain.setValueAtTime(0.0001, t + 4.75);
          oi.frequency.setValueAtTime(95, t + 4.75);
          oi.frequency.exponentialRampToValueAtTime(48, t + 5.15);
          gi.gain.exponentialRampToValueAtTime(0.16, t + 4.79);
          gi.gain.exponentialRampToValueAtTime(0.0001, t + 5.25);
          oi.connect(gi); gi.connect(busFx); oi.start(t + 4.75); oi.stop(t + 5.3);
        } catch (eL) {}
      }
      try {
        var len = Math.floor(ctx.sampleRate * dur);
        var buf = ctx.createBuffer(1, len, ctx.sampleRate);
        var d = buf.getChannelData(0);
        for (var i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
        var src = ctx.createBufferSource(); src.buffer = buf;
        var f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 2.5;
        f.frequency.setValueAtTime(500, t);
        f.frequency.exponentialRampToValueAtTime(2600, t + dur);
        var pan = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
        var g = ctx.createGain();
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(0.16, t + dur * 0.35);
        g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        if (pan) {
          pan.pan.setValueAtTime(-1, t);
          pan.pan.linearRampToValueAtTime(1, t + dur);
          src.connect(f); f.connect(pan); pan.connect(g);
        } else { src.connect(f); f.connect(g); }
        g.connect(busFx);
        src.start(t); src.stop(t + dur);
        /* boom sourd sous le balayage : marque la frontière d'acte */
        var ob = ctx.createOscillator(); ob.type = 'sine';
        var gb = ctx.createGain(); gb.gain.setValueAtTime(0.0001, t);
        ob.frequency.setValueAtTime(62, t);
        ob.frequency.exponentialRampToValueAtTime(34, t + 0.6);
        gb.gain.exponentialRampToValueAtTime(0.20, t + 0.04);
        gb.gain.exponentialRampToValueAtTime(0.0001, t + 0.7);
        ob.connect(gb); gb.connect(busFx); ob.start(t); ob.stop(t + 0.75);
      } catch (e) {}
    },

    /* Niveau de la nappe d'ambiance (arc dramatique du show) */
    padNiveau: function (v) {
      if (!started || !padGain) return;
      padGain.gain.setTargetAtTime(Math.max(v, 0.0001), ctx.currentTime, 1.2);
    },

    /* Transition inter-slides : un son DIFFÉRENT par style de voyage
       caméra, accordé au mouvement (même durée ~0,95 s que la Bézier) :
         0 · arc latéral — souffle qui traverse le panorama (pan suit l'arc)
         1 · plongée     — sifflement descendant + atterrissage feutré
         2 · spirale     — vrille de 5 notes + air tourbillonnant
         3 · traversée   — doppler : monte, passe devant, redescend      */
    transition: function (style, dir) {
      if (!started) return;
      var st = ((style % 8) + 8) % 8;
      var t = ctx.currentTime;
      /* Signature sonore du show : chaque transition se résout sur les
         DEUX MÊMES notes (ré → la). L'oreille du jury reconnaît
         inconsciemment « le son de cette soutenance ». */
      function signature(td) {
        /* le vol dure 2,5 s : la signature ré→la se résout EN approche,
           le thump d'atterrissage tombe pile à la pose (2,2 s) */
        pluck(N.D5, t + 1.85, 0.30, 0.05, 'sine', busMusic);
        pluck(N.A4, t + 1.98, 0.45, 0.05, 'sine', busMusic);
        try {
          var oT = ctx.createOscillator(); oT.type = 'sine';
          var gT = ctx.createGain(); gT.gain.setValueAtTime(0.0001, t + 2.2);
          oT.frequency.setValueAtTime(85, t + 2.2);
          oT.frequency.exponentialRampToValueAtTime(45, t + 2.54);
          gT.gain.exponentialRampToValueAtTime(0.09, t + 2.23);
          gT.gain.exponentialRampToValueAtTime(0.0001, t + 2.6);
          oT.connect(gT); gT.connect(busFx);
          oT.start(t + 2.2); oT.stop(t + 2.64);
        } catch (eT) {}
      }
      try {
        if (st === 4) {
          /* double souffle feutré : deux vagues d'air rapprochées */
          noiseBurst(t, 0.28, dir >= 0 ? 750 : 480, 0.13);
          noiseBurst(t + 0.16, 0.34, dir >= 0 ? 1150 : 620, 0.11);
          pluck(GAMME[5], t + 0.10, 0.5, 0.06, 'triangle', busMusic);
          signature(0.5);
          return;
        }
        if (st === 5) {
          /* marimba feutrée : trois notes boisées, douces et rondes */
          [GAMME[2], GAMME[5], dir >= 0 ? GAMME[8] : GAMME[0]].forEach(function (fq, iB) {
            pluck(fq, t + iB * 0.11, 0.55, 0.09, 'triangle', busMusic);
            pluck(fq * 2, t + iB * 0.11 + 0.01, 0.18, 0.03, 'sine', busMusic);
          });
          signature(0.55);
          return;
        }
        if (st === 6) {
          /* nappe inversée : accord qui enfle "à l'envers" puis se coupe net */
          var accord = dir >= 0 ? [N.D3, N.F3, N.A3, N.C4] : [N.C4, N.A3, N.F3, N.D3];
          accord.forEach(function (fq) {
            var oR = ctx.createOscillator(); oR.type = 'sawtooth'; oR.frequency.value = fq;
            var fR = ctx.createBiquadFilter(); fR.type = 'lowpass';
            fR.frequency.setValueAtTime(300, t);
            fR.frequency.exponentialRampToValueAtTime(2400, t + 0.55);
            var gR = ctx.createGain(); gR.gain.setValueAtTime(0.0001, t);
            gR.gain.exponentialRampToValueAtTime(0.05, t + 0.55);
            gR.gain.setValueAtTime(0.05, t + 0.56);
            gR.gain.exponentialRampToValueAtTime(0.0001, t + 0.60);
            oR.connect(fR); fR.connect(gR); gR.connect(busMusic);
            oR.start(t); oR.stop(t + 0.65);
          });
          signature(0.62);
          return;
        }
        if (st === 7) {
          /* harpe : glissando fulgurant de 8 notes */
          for (var h = 0; h < 8; h++) {
            var posH = dir >= 0 ? h : 7 - h;
            pluck(GAMME[2 + posH], t + h * 0.035, 0.7, 0.075, 'triangle', busMusic);
          }
          signature(0.42);
          return;
        }
        if (st === 0) {
          /* arc : bruit large filtré, panoramique -dir → +dir */
          var len = Math.floor(ctx.sampleRate * 0.55);
          var buf = ctx.createBuffer(1, len, ctx.sampleRate);
          var d = buf.getChannelData(0);
          for (var i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
          var src = ctx.createBufferSource(); src.buffer = buf;
          var f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 0.8;
          f.frequency.setValueAtTime(700, t);
          f.frequency.exponentialRampToValueAtTime(1400, t + 0.28);
          f.frequency.exponentialRampToValueAtTime(600, t + 0.55);
          var g = ctx.createGain();
          g.gain.setValueAtTime(0.0001, t);
          g.gain.exponentialRampToValueAtTime(0.15, t + 0.16);
          g.gain.exponentialRampToValueAtTime(0.0001, t + 0.55);
          var pan = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
          if (pan) {
            pan.pan.setValueAtTime(-0.8 * dir, t);
            pan.pan.linearRampToValueAtTime(0.8 * dir, t + 0.55);
            src.connect(f); f.connect(pan); pan.connect(g);
          } else { src.connect(f); f.connect(g); }
          g.connect(busFx); src.start(t); src.stop(t + 0.6);
        } else if (st === 1) {
          /* plongée : gliss descendant + petit impact d'arrivée */
          var o = ctx.createOscillator(); o.type = 'sine';
          var g1 = ctx.createGain(); g1.gain.setValueAtTime(0.0001, t);
          o.frequency.setValueAtTime(dir >= 0 ? N.A4 : N.D4, t);
          o.frequency.exponentialRampToValueAtTime(dir >= 0 ? N.D3 : N.A2, t + 0.6);
          g1.gain.exponentialRampToValueAtTime(0.10, t + 0.08);
          g1.gain.exponentialRampToValueAtTime(0.0001, t + 0.65);
          o.connect(g1); g1.connect(busMusic); o.start(t); o.stop(t + 0.7);
          var imp = ctx.createOscillator(); imp.type = 'sine';
          var g2 = ctx.createGain(); g2.gain.setValueAtTime(0.0001, t + 0.62);
          imp.frequency.setValueAtTime(90, t + 0.62);
          imp.frequency.exponentialRampToValueAtTime(50, t + 0.85);
          g2.gain.exponentialRampToValueAtTime(0.14, t + 0.65);
          g2.gain.exponentialRampToValueAtTime(0.0001, t + 0.95);
          imp.connect(g2); g2.connect(busFx); imp.start(t + 0.6); imp.stop(t + 1);
        } else if (st === 2) {
          /* spirale : vrille rapide de 5 notes (monte ou descend) + air */
          for (var j = 0; j < 5; j++) {
            var pos = dir >= 0 ? j : 4 - j;
            pluck(GAMME[3 + pos] * (j % 2 ? 1 : 2), t + j * 0.07, 0.24, 0.06,
                  j % 2 ? 'triangle' : 'sine', busMusic);
          }
          noiseBurst(t, 0.5, 1200, 0.08);
        } else {
          /* traversée : doppler — monte, culmine, retombe */
          var len3 = Math.floor(ctx.sampleRate * 0.7);
          var buf3 = ctx.createBuffer(1, len3, ctx.sampleRate);
          var d3 = buf3.getChannelData(0);
          for (var m = 0; m < len3; m++) d3[m] = Math.random() * 2 - 1;
          var src3 = ctx.createBufferSource(); src3.buffer = buf3;
          var f3 = ctx.createBiquadFilter(); f3.type = 'bandpass'; f3.Q.value = 3;
          f3.frequency.setValueAtTime(360, t);
          f3.frequency.exponentialRampToValueAtTime(1900, t + 0.32);
          f3.frequency.exponentialRampToValueAtTime(300, t + 0.7);
          var g3 = ctx.createGain();
          g3.gain.setValueAtTime(0.0001, t);
          g3.gain.exponentialRampToValueAtTime(0.17, t + 0.3);
          g3.gain.exponentialRampToValueAtTime(0.0001, t + 0.7);
          src3.connect(f3); f3.connect(g3); g3.connect(busFx);
          src3.start(t); src3.stop(t + 0.75);
        }
        signature(0.6);
      } catch (e) {}
    },

    /* Manifeste : trois battements graves calés sur la révélation
       ligne à ligne (0,30 s / 1,10 s / 1,90 s) — la ligne or frappe
       plus fort, seule. */
    manifeste: function () {
      if (!started) return;
      var t = ctx.currentTime;
      pluck(N.D3, t + 0.30, 1.0, 0.16, 'sine', busMusic);
      pluck(N.A3, t + 1.10, 1.0, 0.16, 'sine', busMusic);
      pluck(N.D4, t + 1.90, 1.6, 0.24, 'triangle', busMusic);
      pluck(N.D3, t + 1.90, 1.6, 0.10, 'sine', busMusic);   /* octave sous la ligne or */
    },

    /* Cascade : une micro-note par élément qui apparaît, aux mêmes
       délais (100 ms) que l'animation CSS [data-anim] — l'oreille
       "voit" les cartes tomber en place. */
    cascade: function (nb, chap) {
      if (!started || !nb) return;
      var t = ctx.currentTime;
      var base = (chap || 0) % 4;
      for (var i = 0; i < Math.min(nb, 6); i++) {
        var fq = GAMME[(base + i * 2) % GAMME.length];
        pluck(fq * 2, t + 0.10 + i * 0.10, 0.22, 0.045, 'sine', busMusic, i % 2 ? 0.35 : -0.35);
      }
      /* le trait or se dessine sous le mot-clé à 0,85 s : l'oreille suit l'œil */
      pluck(N.D6, t + 0.85, 0.30, 0.032, 'sine', busMusic);
    },

    /* APOTHÉOSE — la supernova finale. Calée sur l'animation 3D :
       0→0,95 s : charge (gronde + monte) · 0,95 s : DÉFLAGRATION
       (hit orchestral + sub-drop) · puis crépitements de feu
       d'artifice pannés au hasard + glissando et accord conclusif. */
    apotheose: function () {
      if (!started) return;
      var t = ctx.currentTime;
      try {
        /* 1) charge LONGUE : gronde grave + souffle qui monte (0 → 2,2 s) —
           les trois spasmes visuels sont ponctués par boum() côté 3D */
        var oC = ctx.createOscillator(); oC.type = 'sawtooth';
        var fC = ctx.createBiquadFilter(); fC.type = 'lowpass'; fC.frequency.value = 300;
        var gC = ctx.createGain(); gC.gain.setValueAtTime(0.0001, t);
        oC.frequency.setValueAtTime(N.D2 / 2, t);
        oC.frequency.exponentialRampToValueAtTime(N.D3, t + 2.15);
        gC.gain.exponentialRampToValueAtTime(0.20, t + 2.1);
        gC.gain.exponentialRampToValueAtTime(0.0001, t + 2.25);
        oC.connect(fC); fC.connect(gC); gC.connect(busFx);
        oC.start(t); oC.stop(t + 2.3);
        noiseBurst(t, 2.2, 800, 0.14);

        var tx = t + 2.2;   /* instant de la déflagration */

        /* 180 ms de noir sonore juste avant le hit : l'impact perçu double */
        master.gain.setTargetAtTime(0.001, tx - 0.18, 0.02);
        master.gain.setTargetAtTime(muted ? 0.0001 : 0.9, tx, 0.012);

        /* 2a) l'ÉCLOSION — accord lumineux qui s'ouvre pile sur
           l'explosion : fluide, majestueux, sans voix. */
        [N.D4, N.F4, N.A4, N.D5, N.A5].forEach(function (fqE, iE) {
          var oE = ctx.createOscillator(); oE.type = 'sine';
          oE.frequency.value = fqE;
          var gE = ctx.createGain(); gE.gain.setValueAtTime(0.0001, tx);
          gE.gain.exponentialRampToValueAtTime(0.12 - iE * 0.012, tx + 0.05 + iE * 0.03);
          gE.gain.exponentialRampToValueAtTime(0.0001, tx + 1.8);
          oE.connect(gE);
          /* l'accord s'ouvre EN LARGEUR : chaque note a sa place dans la salle */
          var pE = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
          if (pE) { pE.pan.value = (iE - 2) * 0.4; gE.connect(pE); pE.connect(busMusic); }
          else { gE.connect(busMusic); }
          oE.start(tx); oE.stop(tx + 1.9);
        });

        /* 2) hit orchestral : pile de saws désaccordées + sub-drop */
        [N.D2, N.A2, N.D3, N.F3, N.A3, N.D4].forEach(function (fq, iH) {
          var oH = ctx.createOscillator(); oH.type = 'sawtooth';
          oH.frequency.value = fq; oH.detune.value = (iH - 2.5) * 7;
          var fH = ctx.createBiquadFilter(); fH.type = 'lowpass';
          fH.frequency.setValueAtTime(3200, tx);
          fH.frequency.exponentialRampToValueAtTime(320, tx + 2.4);
          var gH = ctx.createGain(); gH.gain.setValueAtTime(0.0001, tx);
          gH.gain.exponentialRampToValueAtTime(0.09, tx + 0.02);
          gH.gain.exponentialRampToValueAtTime(0.0001, tx + 2.6);
          oH.connect(fH); fH.connect(gH); gH.connect(busMusic);
          oH.start(tx); oH.stop(tx + 2.7);
        });
        var sub = ctx.createOscillator(); sub.type = 'sine';
        var gS = ctx.createGain(); gS.gain.setValueAtTime(0.0001, tx);
        sub.frequency.setValueAtTime(70, tx);
        sub.frequency.exponentialRampToValueAtTime(28, tx + 1.6);
        gS.gain.exponentialRampToValueAtTime(0.38, tx + 0.04);
        gS.gain.exponentialRampToValueAtTime(0.0001, tx + 1.8);
        sub.connect(gS); gS.connect(busFx); sub.start(tx); sub.stop(tx + 1.9);

        /* 3) crépitements de feu d'artifice, pannés au hasard (4,6 s) */
        for (var kF = 0; kF < 20; kF++) {
          (function (kF) {
            var tk = tx + 0.25 + Math.random() * 4.4;
            var lenK = Math.floor(ctx.sampleRate * 0.14);
            var bufK = ctx.createBuffer(1, lenK, ctx.sampleRate);
            var dK = bufK.getChannelData(0);
            for (var m2 = 0; m2 < lenK; m2++) dK[m2] = (Math.random() * 2 - 1) * (1 - m2 / lenK);
            var sK = ctx.createBufferSource(); sK.buffer = bufK;
            var fK = ctx.createBiquadFilter(); fK.type = 'highpass'; fK.frequency.value = 1800;
            var gK = ctx.createGain(); gK.gain.value = 0.10;
            var pK = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
            if (pK) { pK.pan.value = Math.random() * 2 - 1; sK.connect(fK); fK.connect(pK); pK.connect(gK); }
            else { sK.connect(fK); fK.connect(gK); }
            gK.connect(busFx); sK.start(tk); sK.stop(tk + 0.15);
          })(kF);
        }

        /* 4) glissando ascendant + accord conclusif scintillant */
        for (var g2 = 0; g2 < 10; g2++) {
          pluck(GAMME[g2 % GAMME.length] * (g2 > 5 ? 2 : 1), tx + 1.1 + g2 * 0.06, 0.5, 0.06, 'triangle', busMusic);
        }
        [N.D4, N.F4, N.A4, N.D5, N.F5, N.A5, N.D6].forEach(function (fq, i3) {
          pluck(fq, tx + 1.9 + i3 * 0.05, 2.2, 0.10, 'sine', busMusic);
        });
        /* 5) l'ÉCHO : second accord doux pendant la ronde, puis le ré
           fondamental qui referme le show — la boucle harmonique se boucle */
        [N.D5, N.F5, N.A5, N.D6].forEach(function (fq, i4) {
          pluck(fq, tx + 4.6 + i4 * 0.09, 2.4, 0.06, 'sine', busMusic, (i4 - 1.5) * 0.4);
        });
        pluck(N.D2, tx + 6.4, 2.4, 0.12, 'sine', busFx);
        pluck(N.D3, tx + 6.4, 2.2, 0.06, 'triangle', busMusic);
        /* 6) les DERNIÈRES BRAISES : scintillement aigu + trois étoiles
           qui s'éteignent une à une pendant la plongée dans la pluie d'or */
        noiseBurst(tx + 8.6, 1.4, 5500, 0.045);
        [N.D6, N.A5, N.D5].forEach(function (fq, i5) {
          pluck(fq, tx + 8.8 + i5 * 0.5, 1.8, 0.05, 'sine', busMusic, (i5 - 1) * 0.5);
        });
      } catch (e) {}
    },

    // Bouquet final (scintillement + impact)
    finale: function () {
      if (!started) return;
      var t = ctx.currentTime;
      [N.D4, N.F4, N.A4, N.C5, N.D5, N.F5, N.A5, N.D6].forEach(function (f, i) {
        pluck(f, t + i * 0.09, 1.6, 0.13, 'triangle', busMusic);
      });
      noiseBurst(t, 1.2, 1600, 0.18);
      try {
        // impact grave
        var o = ctx.createOscillator(); o.type = 'sine';
        var g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t);
        o.frequency.setValueAtTime(120, t); o.frequency.exponentialRampToValueAtTime(40, t + 1.2);
        g.gain.exponentialRampToValueAtTime(0.3, t + 0.04);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 1.4);
        o.connect(g); g.connect(busFx); o.start(t); o.stop(t + 1.5);
      } catch (e) {}
    }
  };

  global.AudioFX = api;
})(window);
