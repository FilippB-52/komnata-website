/* ==========================================================================
   KØMNATA — vinyl player
   One record, one tonearm, one drag. No dependencies.

   Drop this in the page:
     <div data-vinyl data-cover="assets/img/playlist-01.jpg"
          data-title="The main room" data-turn="9"></div>

   Attributes, all optional:
     data-cover  image for the centre label. Square crops best.
     data-title  playlist name, read out to screen readers.
     data-turn   seconds for one revolution. 9 is the house default,
                 1.8 would be a real 33 rpm and is far too fast to watch.
     data-notes  "off" kills the music symbols.
   Anything you nest inside the div is used as the label art instead of
   data-cover, so an <img>, an <svg> or a poster all work.

   Interaction: hold the record to stop it and turn it by hand, let go and it
   picks the speed back up. Space or Enter does the same from the keyboard.
   ========================================================================== */
(function (window, document) {
  'use strict';

  /* Geometry. These match vinyl-player.css; change both or neither. */
  var PIVOT_X   = 912,     /* tonearm pivot, in the 1000-unit stage */
      PIVOT_Y   = 178,
      ARM_BASE  = 102.42,  /* angle that puts the stylus in the lead-in groove */
      ARM_LEN   = 558,     /* pivot to stylus */
      TIP_Y     = 19,      /* the headshell offsets the stylus off the tube axis */
      ARM_START = 3,       /* degrees of travel at the first track */
      ARM_END   = 25,      /* degrees at the run-out, just outside the label */
      ARM_RATE  = 0.82;    /* degrees of travel per revolution of the record */

  var GLYPHS = ['♪', '♫', '♩', '♬', '♪', '♫'];
  var NOTE_CAP = 16;

  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------------------------------------------------------------- markup */
  function build(root, art) {
    var stage = document.createElement('div');
    stage.className = 'vinyl__stage';
    stage.innerHTML =
      '<div class="vinyl__shadow" aria-hidden="true"></div>' +
      '<div class="vinyl__rim" aria-hidden="true"></div>' +
      '<div class="vinyl__mat" aria-hidden="true"></div>' +
      '<div class="vinyl__disc" tabindex="0" role="button" aria-pressed="false">' +
        /* Grooves and track lands are perfectly rotationally symmetric, so
           they look identical at every angle and must NOT sit in the rotating
           layer. Inside it they get re-rasterised at a new sub-pixel offset
           every time anything forces a repaint, and a 3.4px ring pattern
           re-sampled at a new angle beats against the pixel grid: that is the
           flashing. Out here they are painted once and never touched again. */
        '<div class="vinyl__grooves"></div>' +
        '<div class="vinyl__bands"></div>' +
        '<div class="vinyl__spin">' +
          '<div class="vinyl__dust"></div>' +
          '<div class="vinyl__sheen"></div>' +
          '<div class="vinyl__label"></div>' +
        '</div>' +
        '<div class="vinyl__gloss"></div>' +
        '<div class="vinyl__edge"></div>' +
      '</div>' +
      '<div class="vinyl__hole" aria-hidden="true"></div>' +
      arm() +
      '<div class="vinyl__notes" aria-hidden="true"></div>';

    root.appendChild(stage);
    stage.querySelector('.vinyl__label').appendChild(art);
    return stage;
  }

  /* The arm is drawn flat along +x from the pivot, then swung into place.
     That way the only thing that ever animates is one angle. */
  function arm() {
    return '' +
    '<svg class="vinyl__arm" viewBox="0 0 1000 1000" aria-hidden="true" focusable="false">' +
      '<defs>' +
        /* bright at the bottom of each part, because after the base rotation
           that is the side facing the light */
        '<linearGradient id="v-tube" x1="0" y1="1" x2=".28" y2="0">' +
          '<stop offset="0" stop-color="#F7F3EB"/><stop offset=".14" stop-color="#C5C0B5"/>' +
          '<stop offset=".42" stop-color="#6E7276"/><stop offset=".72" stop-color="#34383B"/>' +
          '<stop offset="1" stop-color="#1B1E20"/>' +
        '</linearGradient>' +
        '<linearGradient id="v-weight" x1="0" y1="1" x2=".22" y2="0">' +
          '<stop offset="0" stop-color="#EEEAE1"/><stop offset=".18" stop-color="#A8A399"/>' +
          '<stop offset=".5" stop-color="#4E5256"/><stop offset="1" stop-color="#191C1E"/>' +
        '</linearGradient>' +
        '<linearGradient id="v-shell" x1="0" y1="1" x2=".18" y2="0">' +
          '<stop offset="0" stop-color="#F6F3EC"/><stop offset=".26" stop-color="#B8B3A8"/>' +
          '<stop offset=".64" stop-color="#55595D"/><stop offset="1" stop-color="#212427"/>' +
        '</linearGradient>' +
        '<radialGradient id="v-post" cx=".36" cy=".3" r=".8">' +
          '<stop offset="0" stop-color="#7D8185"/><stop offset=".55" stop-color="#3B3F42"/>' +
          '<stop offset="1" stop-color="#15181A"/>' +
        '</radialGradient>' +
      '</defs>' +

      /* the post the arm turns on. Fixed, so it stays put while the arm swings */
      '<circle cx="912" cy="178" r="41" fill="url(#v-post)"/>' +
      '<circle cx="912" cy="178" r="41" fill="none" stroke="rgba(255,255,255,.16)" stroke-width="1.5"/>' +
      '<circle cx="912" cy="178" r="27" fill="none" stroke="rgba(0,0,0,.55)" stroke-width="1"/>' +

      '<g class="vinyl__arm-swing">' +
        '<g transform="translate(912,178) rotate(' + ARM_BASE + ')">' +

          /* counterweight, a turned cylinder with two grooves cut in it */
          '<rect x="-112" y="-31" width="66" height="62" rx="9" fill="url(#v-weight)"/>' +
          '<rect x="-112" y="-31" width="66" height="62" rx="9" fill="none" stroke="rgba(0,0,0,.55)" stroke-width="1"/>' +
          '<rect x="-96" y="-31" width="2.4" height="62" fill="rgba(0,0,0,.35)"/>' +
          '<rect x="-72" y="-31" width="2.4" height="62" fill="rgba(0,0,0,.35)"/>' +
          '<rect x="-112" y="17" width="66" height="7" rx="3.5" fill="rgba(255,255,255,.2)"/>' +
          '<rect x="-46" y="-8" width="28" height="16" rx="3" fill="url(#v-weight)"/>' +

          /* gimbal housing over the pivot */
          '<rect x="-22" y="-27" width="56" height="54" rx="10" fill="url(#v-weight)"/>' +
          '<rect x="-22" y="-27" width="56" height="54" rx="10" fill="none" stroke="rgba(0,0,0,.55)" stroke-width="1"/>' +
          '<rect x="-14" y="16" width="40" height="6" rx="3" fill="rgba(255,255,255,.26)"/>' +
          '<circle cx="6" cy="0" r="9" fill="rgba(0,0,0,.35)"/>' +
          '<circle cx="6" cy="1.5" r="9" fill="none" stroke="rgba(255,255,255,.2)" stroke-width="1.2"/>' +

          /* the tube, tapering toward the headshell */
          '<path d="M32,-10 L498,-6.4 L498,6.4 L32,10 Z" fill="url(#v-tube)"/>' +
          '<path d="M36,7 L496,4.5" stroke="rgba(255,255,255,.7)" stroke-width="2" fill="none"/>' +
          '<path d="M36,-7.8 L496,-4.9" stroke="rgba(0,0,0,.55)" stroke-width="1.8" fill="none"/>' +

          /* headshell, cartridge, stylus */
          '<g transform="translate(498,0) rotate(22)">' +
            '<path d="M-8,-15 L16,-21 L46,-17 L62,-9 L64,0 L62,9 L46,17 L16,21 L-8,15 Z" fill="url(#v-shell)"/>' +
            '<path d="M-8,-15 L16,-21 L46,-17 L62,-9 L64,0 L62,9 L46,17 L16,21 L-8,15 Z" fill="none" stroke="rgba(0,0,0,.6)" stroke-width="1.2"/>' +
            '<path d="M-2,13 L40,16" stroke="rgba(255,255,255,.55)" stroke-width="2" fill="none"/>' +
            '<rect x="18" y="-12" width="42" height="24" rx="3.5" fill="#131618"/>' +
            '<rect x="18" y="-12" width="42" height="24" rx="3.5" fill="none" stroke="rgba(255,255,255,.16)" stroke-width="1"/>' +
            '<rect x="23" y="-7" width="12" height="4.5" rx="1.5" fill="rgba(141,238,237,.34)"/>' +
            '<path d="M55,6 L63,15 L58,16.5 Z" fill="#DDD8CE"/>' +
            '<circle cx="62.5" cy="15.5" r="2.6" fill="rgba(255,255,255,.92)"/>' +
          '</g>' +

        '</g>' +
      '</g>' +
    '</svg>';
  }

  /* The house label, used when no cover is given. Inline so it inherits the
     page's fonts and the cyan token. */
  function defaultLabel(title) {
    var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 300 300');
    svg.setAttribute('aria-hidden', 'true');
    svg.innerHTML =
      '<defs>' +
        '<path id="v-ring-top" d="M32,150 A118,118 0 0 1 268,150" fill="none"/>' +
        '<path id="v-ring-bot" d="M36,150 A114,114 0 0 0 264,150" fill="none"/>' +
      '</defs>' +
      '<circle cx="150" cy="150" r="150" fill="#EFECE6"/>' +
      '<circle cx="150" cy="150" r="131" fill="none" stroke="#0B0C0D" stroke-width="1.2" opacity=".45"/>' +
      '<circle cx="150" cy="150" r="96" fill="none" stroke="#0B0C0D" stroke-width="1" opacity=".22"/>' +
      '<text font-family="var(--mono, monospace)" font-size="15" letter-spacing="5.5" fill="#0B0C0D">' +
        '<textPath href="#v-ring-top" startOffset="50%" text-anchor="middle">KØMNATA · MADRID</textPath>' +
      '</text>' +
      '<text font-family="var(--mono, monospace)" font-size="13" letter-spacing="4.5" fill="#0B0C0D" opacity=".62">' +
        '<textPath href="#v-ring-bot" startOffset="50%" text-anchor="middle">SIDE A · 33 ⅓ RPM</textPath>' +
      '</text>' +
      '<text x="150" y="150" font-family="var(--sans, sans-serif)" font-size="86" font-weight="800" ' +
        'letter-spacing="-4" fill="#0B0C0D" text-anchor="middle" dominant-baseline="central">Ø</text>' +
      '<circle cx="150" cy="150" r="43" fill="none" stroke="#256F6E" stroke-width="1.4" opacity=".7"/>' +
      '<text x="150" y="216" font-family="var(--mono, monospace)" font-size="12" letter-spacing="3" ' +
        'fill="#0B0C0D" opacity=".5" text-anchor="middle">' + esc(title || 'PLAYLIST Ø1') + '</text>';
    return svg;
  }

  function esc(s) {
    return String(s).replace(/[&<>]/g, function (c) {
      return c === '&' ? '&amp;' : c === '<' ? '&lt;' : '&gt;';
    });
  }

  /* ------------------------------------------------------------ the player */
  function init(root) {
    if (root.__vinyl) return root.__vinyl;
    root.classList.add('vinyl');

    var title = root.getAttribute('data-title') || 'playlist',
        cover = root.getAttribute('data-cover'),
        turn  = parseFloat(root.getAttribute('data-turn')) || 9,
        notesOn = root.getAttribute('data-notes') !== 'off' && !reduce;

    /* label art: nested markup wins, then data-cover, then the house label */
    var art;
    if (root.firstElementChild) {
      art = root.firstElementChild;
      root.removeChild(art);
    } else if (cover) {
      art = document.createElement('img');
      art.src = cover;
      art.alt = '';
      art.loading = 'lazy';
    } else {
      art = defaultLabel(root.getAttribute('data-label'));
    }

    var stage = build(root, art),
        disc  = stage.querySelector('.vinyl__disc'),
        notes = stage.querySelector('.vinyl__notes');

    disc.setAttribute('aria-label', 'Record for ' + title + '. Hold to stop it and turn it by hand.');

    var target = 360 / turn,   /* degrees per second */
        omega  = reduce ? 0 : target,
        rot    = 0,
        revs   = 0,
        held   = false,
        live   = true,
        lastT  = 0,
        nextNote = 0;

    /* ------------------------------------------------------------ the loop */
    function frame(t) {
      if (!live) { lastT = t; requestAnimationFrame(frame); return; }
      var dt = lastT ? Math.min((t - lastT) / 1000, 0.05) : 0;
      lastT = t;

      if (!held) {
        /* ease back to speed, fast enough to feel like a motor, slow enough
           that a flick still carries */
        omega += (target - omega) * (1 - Math.exp(-dt / 0.75));
      }

      rot  += omega * dt;
      revs += Math.abs(omega * dt) / 360;
      if (rot > 360000 || rot < -360000) rot = rot % 360;

      root.style.setProperty('--v-rot', rot.toFixed(2) + 'deg');
      root.style.setProperty('--v-arm',
        Math.min(ARM_END, ARM_START + revs * ARM_RATE).toFixed(2) + 'deg');

      if (notesOn && !held && t > nextNote && Math.abs(omega) > target * 0.35) {
        emit();
        nextNote = t + 480 + Math.random() * 420;
      }
      requestAnimationFrame(frame);
    }

    /* ----------------------------------------------------------- the notes */
    function emit() {
      if (notes.childElementCount >= NOTE_CAP) return;

      var size = root.clientWidth,
          armDeg = parseFloat(root.style.getPropertyValue('--v-arm')) || ARM_START,
          a = (ARM_BASE + armDeg) * Math.PI / 180,
          /* where the stylus is sitting right now, in stage units */
          x = PIVOT_X + ARM_LEN * Math.cos(a) - TIP_Y * Math.sin(a),
          y = PIVOT_Y + ARM_LEN * Math.sin(a) + TIP_Y * Math.cos(a);

      var n = document.createElement('span');
      n.className = 'vinyl__note';
      n.textContent = GLYPHS[(Math.random() * GLYPHS.length) | 0];
      n.style.left = (x / 10) + '%';
      n.style.top  = (y / 10) + '%';
      n.style.setProperty('--n-size', (size * (0.028 + Math.random() * 0.022)).toFixed(1) + 'px');
      n.style.setProperty('--n-dx',   (size * (0.01 + Math.random() * 0.12)).toFixed(1) + 'px');
      n.style.setProperty('--n-dy',   (size * -(0.22 + Math.random() * 0.17)).toFixed(1) + 'px');
      n.style.setProperty('--n-sway', (size * (Math.random() < 0.5 ? -0.035 : 0.035)).toFixed(1) + 'px');
      n.style.setProperty('--n-rot',  ((Math.random() * 40) - 16).toFixed(0) + 'deg');
      n.style.setProperty('--n-dur',  (3.1 + Math.random() * 1.6).toFixed(2) + 's');
      n.style.setProperty('--n-peak', (0.2 + Math.random() * 0.2).toFixed(2));
      n.addEventListener('animationend', function () { n.remove(); });
      notes.appendChild(n);
    }

    /* ------------------------------------------------------------ the drag */
    var grabAngle = 0, vel = 0, lastMove = 0;

    function angleOf(e) {
      var r = disc.getBoundingClientRect();
      return Math.atan2(e.clientY - (r.top + r.height / 2),
                        e.clientX - (r.left + r.width / 2)) * 180 / Math.PI;
    }

    disc.addEventListener('pointerdown', function (e) {
      if (e.button !== undefined && e.button !== 0) return;
      held = true; vel = 0; omega = 0;
      grabAngle = angleOf(e);
      lastMove = performance.now();
      root.classList.add('is-held');
      disc.setAttribute('aria-pressed', 'true');
      try { disc.setPointerCapture(e.pointerId); } catch (err) { /* synthetic events have no capture */ }
      e.preventDefault();
    });

    disc.addEventListener('pointermove', function (e) {
      if (!held) return;
      var a = angleOf(e),
          d = a - grabAngle;
      while (d > 180) d -= 360;
      while (d < -180) d += 360;
      grabAngle = a;

      var now = performance.now(),
          dt = Math.max((now - lastMove) / 1000, 0.001);
      lastMove = now;

      rot += d;
      /* smoothed, so one jittery sample cannot launch the record */
      vel += ((d / dt) - vel) * 0.35;
      root.style.setProperty('--v-rot', rot.toFixed(2) + 'deg');
    });

    function release(e) {
      if (!held) return;
      held = false;
      root.classList.remove('is-held');
      disc.setAttribute('aria-pressed', 'false');
      /* a flick carries, but never faster than three times playing speed */
      omega = Math.max(-target * 3, Math.min(target * 3, vel));
      if (performance.now() - lastMove > 140) omega = 0;   /* held still, so start from rest */
      try {
        if (e && e.pointerId !== undefined && disc.hasPointerCapture(e.pointerId)) {
          disc.releasePointerCapture(e.pointerId);
        }
      } catch (err) { /* nothing was captured */ }
    }
    disc.addEventListener('pointerup', release);
    disc.addEventListener('pointercancel', release);

    /* keyboard: same gesture, one key */
    disc.addEventListener('keydown', function (e) {
      if (e.key !== ' ' && e.key !== 'Enter') return;
      e.preventDefault();
      if (held) return;
      if (Math.abs(omega) > 1) { omega = 0; held = true; root.classList.add('is-held'); disc.setAttribute('aria-pressed', 'true'); }
    });
    disc.addEventListener('keyup', function (e) {
      if (e.key !== ' ' && e.key !== 'Enter') return;
      if (held) { held = false; root.classList.remove('is-held'); disc.setAttribute('aria-pressed', 'false'); }
    });

    /* stop the loop when nobody is looking */
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (entries) {
        live = entries[0].isIntersecting;
        if (live) lastT = 0;
      }, { threshold: 0 }).observe(root);
    }
    document.addEventListener('visibilitychange', function () {
      if (!document.hidden) lastT = 0;
    });

    requestAnimationFrame(frame);

    var api = {
      el: root,
      stop: function () { omega = 0; },
      start: function () { omega = target; },
      setCover: function (src) {
        var box = stage.querySelector('.vinyl__label');
        box.innerHTML = '';
        var img = document.createElement('img');
        img.src = src; img.alt = '';
        box.appendChild(img);
      }
    };
    root.__vinyl = api;
    return api;
  }

  function initAll(scope) {
    (scope || document).querySelectorAll('[data-vinyl]').forEach(init);
  }

  window.KomnataVinyl = { init: init, initAll: initAll };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { initAll(); });
  } else {
    initAll();
  }

})(window, document);
