/* ==========================================================================
   KØMNATA — motion
   Deliberately small. Lenis for scroll weight, ScrollTrigger for entrances
   that fire once. Nothing runs per frame: no filters, no blend modes, no
   cursor loop, no JS-driven marquee. That is what was making it crawl.
   ========================================================================== */
(function () {
  'use strict';

  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* --- META PIXEL EVENTS ------------------------------------------------- */
  /* The base code in <head> fires PageView. This is the button event: the one
     link that actually leaves for the ticket seller. InitiateCheckout is the
     right standard event because the purchase itself completes on Patt and
     never comes back to us, so Purchase would be a lie.

     Guarded on fbq existing: an ad blocker, a tracker-blocking browser or a
     failed CDN all leave it undefined, and this must not take the click with
     it. The link is not delayed waiting for the beacon either. */
  document.addEventListener('click', function (e) {
    var a = e.target.closest ? e.target.closest('[data-buy]') : null;
    if (!a || typeof window.fbq !== 'function') return;
    try {
      window.fbq('track', 'InitiateCheckout', {
        content_name: 'KOMNATA 27 Frames',
        content_category: 'event ticket'
      });
    } catch (err) { /* never let a tracker break a ticket link */ }
  }, true);

  /* --- INPUT LOCKDOWN ---------------------------------------------------- */
  /* Deliberately above the gsap guard: if the CDN is blocked the page still
     must not pinch, and everything below this point is skipped on that return.

     iOS Safari has ignored user-scalable=no since iOS 10, so the meta tag does
     not stop a pinch there. These three Safari-only gesture events are what
     does. Non-passive, because calling preventDefault is the entire point.
     Double-tap zoom is handled in CSS by touch-action:manipulation.

     Nothing here touches a single-finger gesture, so scrolling, the record
     rail swipe and the vinyl drag are all unaffected: gesture* only fires for
     two fingers, and dragstart never fires for a tap or a scroll. */
  ['gesturestart', 'gesturechange', 'gestureend'].forEach(function (type) {
    document.addEventListener(type, function (e) { e.preventDefault(); }, { passive: false });
  });
  /* Catches Firefox and anything else that ignores -webkit-user-drag. */
  document.addEventListener('dragstart', function (e) { e.preventDefault(); });

  if (typeof gsap === 'undefined') return;
  gsap.registerPlugin(ScrollTrigger);

  /* --- SMOOTH SCROLL ---------------------------------------------------- */
  var lenis = null;
  if (!reduce && typeof Lenis !== 'undefined') {
    lenis = new Lenis({
      duration: 1.1,
      easing: function (t) { return Math.min(1, 1.001 - Math.pow(2, -10 * t)); },
      smoothWheel: true
    });
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add(function (time) { lenis.raf(time * 1000); });
    gsap.ticker.lagSmoothing(0);
  }

  document.querySelectorAll('a[href^="#"]').forEach(function (a) {
    a.addEventListener('click', function (e) {
      var id = a.getAttribute('href');
      if (id.length < 2) return;
      var target = document.querySelector(id);
      if (!target) return;
      e.preventDefault();
      if (lenis) lenis.scrollTo(target, { duration: 1.1 });
      else target.scrollIntoView();
    });
  });

  /* --- NAV -------------------------------------------------------------- */
  var nav = document.getElementById('nav');
  ScrollTrigger.create({
    start: 'top -50',
    onUpdate: function (self) { nav.classList.toggle('is-stuck', self.scroll() > 50); }
  });

  var links = Array.prototype.slice.call(document.querySelectorAll('[data-nav]'));
  links.forEach(function (a) {
    var section = document.getElementById(a.getAttribute('data-nav'));
    if (!section) return;
    ScrollTrigger.create({
      trigger: section, start: 'top 45%', end: 'bottom 45%',
      onToggle: function (self) {
        if (!self.isActive) return;
        links.forEach(function (l) { l.setAttribute('aria-current', l === a ? 'true' : 'false'); });
      }
    });
  });

  /* --- COUNTDOWN --------------------------------------------------------- */
  /* Ticks to the door time in Madrid. The target carries its own +02:00
     offset, so a phone set to any other timezone still counts to the right
     moment. Stops itself once the doors open. */
  var clock = document.querySelector('[data-countdown]');
  if (clock) {
    var target = new Date(clock.getAttribute('data-countdown')).getTime();
    var cells = clock.querySelectorAll('b');
    var tick = function () {
      var left = target - Date.now();
      if (left <= 0) {
        clock.innerHTML = '<span>Tonight</span>';
        clearInterval(timer);
        return;
      }
      var s = Math.floor(left / 1000);
      var parts = [Math.floor(s / 86400), Math.floor(s / 3600) % 24, Math.floor(s / 60) % 60, s % 60];
      parts.forEach(function (n, i) {
        var v = String(n).padStart(2, '0');
        if (cells[i].textContent !== v) cells[i].textContent = v;
      });
    };
    tick();
    var timer = setInterval(tick, 1000);
  }

  /* --- THIRD PARTY FRAMES ------------------------------------------------ */
  /* Google Maps is ~1.9 MB of script and Instagram's embed pulls ~3.5 MB of
     its own. Neither is requested until its section is one screen away, so
     the hero never competes with them. */
  /* The gallery strip loads as one unit rather than tile by tile. Per-image
     lazy loading fights a moving track: a tile can scroll into frame before
     its own fetch has started and show up blank. */
  var strip = document.querySelector('[data-strip]');
  if (strip) {
    var fillStrip = function () {
      /* One file per animation frame rather than 22 in a single tick, so
         decoding never lands on one frame. Measured cost here is nil either
         way, it is cheap insurance for slower machines than this one. */
      var queue = Array.prototype.slice.call(strip.querySelectorAll('img[data-src]'));
      (function next() {
        var img = queue.shift();
        if (!img) return;
        img.src = img.getAttribute('data-src');
        img.removeAttribute('data-src');
        requestAnimationFrame(next);
      })();
    };
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (entries, obs) {
        if (!entries[0].isIntersecting) return;
        fillStrip(); obs.disconnect();
      }, { rootMargin: '150% 0px' }).observe(strip);
    } else { fillStrip(); }
  }

  /* Social sits one screen below the hero, so a generous margin on the
     Instagram frame means it fires at scroll zero and puts 3.5 MB in front of
     the hero. It gets a short lead instead. The map is far enough down that a
     full screen of warning costs nothing. */
  [['[data-tg]', 'KØMNATA on Telegram', '25% 0px'],
   ['[data-ig]', 'KØMNATA on Instagram', '25% 0px']].forEach(function (pair) {
    var box = document.querySelector(pair[0]);
    if (!box) return;
    var load = function () {
      if (box.dataset.loaded) return;
      box.dataset.loaded = '1';
      var f = document.createElement('iframe');
      f.title = pair[1];
      f.referrerPolicy = 'no-referrer-when-downgrade';
      f.loading = 'lazy';
      f.scrolling = 'no';
      f.src = box.dataset.src;
      box.appendChild(f);
      if (box.hasAttribute('data-ig') || box.hasAttribute('data-tg')) fitSlots();  // hoisted
    };
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (entries, obs) {
        if (!entries[0].isIntersecting) return;
        load(); obs.disconnect();
      }, { rootMargin: pair[2] }).observe(box);
    } else { load(); }
  });

  /* --- INSTAGRAM FIT ----------------------------------------------------- */
  /* On a phone the social cards sit two up, so the Instagram slot is about
     140px wide. Instagram's embed will not lay out below roughly 320px, so it
     is rendered at its own width and scaled down. The numbers are resolved in
     px here and handed to CSS, because a transform cannot do arithmetic on a
     clamp() and the slot width is a clamp all the way up. */
  /* Neither embed lays out sensibly below about 320px, and the social cards
     sit two up on a phone, so each slot is about 140px wide there. Both are
     therefore rendered at a fixed width and scaled to fit. Resolved px are
     handed to CSS because a transform cannot do arithmetic on a clamp, and the
     slot width is a clamp all the way up.

     The slots are the same size as each other, which is the point: a live
     embed beside a static card looked wrong, and two embeds at different sizes
     would too.

     Instagram is only scaled on a phone; above that it lays out fine at the
     slot's real width. Telegram is scaled at EVERY width, for a different
     reason than height: its message bubble has a max width, so given a 530px
     slot it centres the bubble and paints the rest of the frame WHITE, which
     is glaring in a monochrome dark card. At a 340px render the bubble fills
     the frame edge to edge, so that is what gets rendered and scaled up.

     The render height stays derived from the slot in both cases, so each frame
     shows exactly its slot's worth of the top of the post. The post's text
     never reaches the frame because its photo alone is roughly as tall as the
     slot is wide. */
  var EMBED_RENDER = 340;
  var phone = window.matchMedia('(max-width: 760px)');

  function fitSlots() {
    [['[data-ig]', false], ['[data-tg]', true]].forEach(function (pair) {
      var slot = document.querySelector(pair[0]);
      if (!slot || !slot.querySelector('iframe')) return;
      if (!pair[1] && !phone.matches) {
        slot.style.removeProperty('--ig-w');
        slot.style.removeProperty('--ig-h');
        slot.style.removeProperty('--ig-scale');
        return;
      }
      var r = slot.getBoundingClientRect();
      if (!r.width || !r.height) return;
      var scale = r.width / EMBED_RENDER;
      slot.style.setProperty('--ig-w', EMBED_RENDER + 'px');
      slot.style.setProperty('--ig-h', Math.round(r.height / scale) + 'px');
      slot.style.setProperty('--ig-scale', scale.toFixed(4));
    });
  }

  /* --- RECORD DECK ------------------------------------------------------- */
  /* Below 980px the three records are one snap rail. The arrows do nothing
     the finger cannot already do, they just make it visible that there is
     more than one record, which a silent snap rail never does. */
  (function () {
    var deck = document.querySelector('[data-deck]');
    if (!deck) return;
    var rail  = deck.querySelector('[data-deck-rail]');
    var prev  = deck.querySelector('[data-deck-prev]');
    var next  = deck.querySelector('[data-deck-next]');
    var dotbox = deck.querySelector('[data-deck-dots]');
    var cards = [].slice.call(rail.querySelectorAll('.record'));
    if (!rail || cards.length < 2) return;

    for (var i = 0; i < cards.length; i++) dotbox.appendChild(document.createElement('i'));
    var dots = dotbox.children;

    function index() {
      // nearest card centre to the rail centre, which is what snap lands on
      var mid = rail.scrollLeft + rail.clientWidth / 2;
      var best = 0, bestD = Infinity;
      for (var i = 0; i < cards.length; i++) {
        var c = cards[i].offsetLeft + cards[i].offsetWidth / 2;
        var d = Math.abs(c - mid);
        if (d < bestD) { bestD = d; best = i; }
      }
      return best;
    }

    function sync() {
      var i = index();
      for (var k = 0; k < dots.length; k++) dots[k].className = k === i ? 'is-on' : '';
      prev.disabled = i === 0;
      next.disabled = i === cards.length - 1;
    }

    function go(dir) {
      var i = Math.min(cards.length - 1, Math.max(0, index() + dir));
      rail.scrollTo({
        left: cards[i].offsetLeft - (rail.clientWidth - cards[i].offsetWidth) / 2,
        behavior: 'smooth'
      });
    }
    prev.addEventListener('click', function () { go(-1); });
    next.addEventListener('click', function () { go(1); });

    var tick = 0;
    rail.addEventListener('scroll', function () {
      cancelAnimationFrame(tick);
      tick = requestAnimationFrame(sync);
    }, { passive: true });

    /* Arrow placement is pure CSS: the card padding and the vinyl size are
       both known there, so nothing here has to measure a box that is still
       settling. Only the dots and the Instagram scale need JS. */
    function relayout() { sync(); fitSlots(); }
    relayout();
    window.addEventListener('resize', relayout);
    window.addEventListener('orientationchange', relayout);
    window.addEventListener('load', relayout);

    if ('ResizeObserver' in window) {
      var slot = document.querySelector('[data-ig]');
      if (slot) new ResizeObserver(function () { fitSlots(); }).observe(slot);
      var tg = document.querySelector('[data-tg]');
      if (tg) new ResizeObserver(function () { fitSlots(); }).observe(tg);
    } else {
      setTimeout(relayout, 600);
    }
  })();

  if (reduce) return;

  /* --- BACKDROP ---------------------------------------------------------- */
  /* Nothing behind the hero. The layer comes up across the first section after it,
     which since the reorder is Next night, and stays for the rest of the page. The tilt drifts a few degrees on the way
     down so the bands are not the same shape at the top and the bottom. */
  var backdrop = document.querySelector('[data-backdrop]');
  if (backdrop) {
    /* The shader is deliberately left bright and the layer is dimmed here
       instead: opacity on a composited layer is free, turning the light down
       in the shader is not, and this is the one number to change if it wants
       to be stronger or weaker. */
    /* Opacity .37, up from .30 on request.

       The ramp now starts at 'top bottom' instead of 'top 45%'. That matters
       more than the number: at 'top 45%' the layer was still at zero opacity
       at the exact moment the hero's bottom edge crossed the middle of the
       screen, so the page went textured video -> half a screen of dead flat
       #0B0C0D -> teal. Measured: pixel stddev fell from 1.8 inside the hero
       to 0.0 for ~500px below it. That flat band is what read as a hard cut,
       not any brightness step at the seam, which measures 5/765.

       Starting at 'top bottom' costs nothing during the hero, because
       .backdrop is z-index:-1 and the hero video paints over it. By the time the video
       is gone the teal is already ~0.16 and rising, so there is no gap. */
    gsap.fromTo(backdrop, { opacity: 0 }, {
      /* .14, and that number is a legibility limit rather than a taste call.
         The layer peaks at #C9CECD, so composited over the page ground the
         brightest the ribbon ever gets behind copy is:
           .10 -> #1E1F20  lede 5.11:1
           .14 -> #262728  lede 4.63:1   <- here
           .18 -> #2D2F30  lede 4.16:1   below the 4.5:1 threshold
           .26 -> #3C3E3F  lede 3.33:1
         Small --mute-2 labels do not clear 4.5:1 at any usable value; the
         only place they sit directly on the backdrop is the footer. */
      opacity: .14, ease: 'none',
      scrollTrigger: { trigger: '#tickets', start: 'top bottom', end: 'bottom 55%', scrub: .8 }
    });
    /* Rendering is switched by scroll POSITION, never by reading the animated
       opacity: that value is scrubbed with an 0.8s lag, so sampling it inside
       a scroll handler raced the scrub and left the layer frozen at the Music
       section.

       No end and no onToggle here. A trigger ending at 'max' is active for
       start <= scroll < end, so landing on the very last pixel of the page
       toggled it OFF while the layer was still at opacity .3: the bands sat
       visible and frozen at the footer. Measured on both layouts before the
       change. onEnter/onLeaveBack has no far edge to fall off, so the layer
       runs from the moment Social appears until you scroll back above it. */
    ScrollTrigger.create({
      trigger: '#tickets', start: 'top bottom',
      onEnter:     function () { if (window.KomnataBackdrop) window.KomnataBackdrop.setVisible(true); },
      onLeaveBack: function () { if (window.KomnataBackdrop) window.KomnataBackdrop.setVisible(false); }
    });
  }

  /* --- POPUP ------------------------------------------------------------- */
  /* Up after 3s. Scroll is stopped while it is open, and Lenis has to be told
     separately: it drives scrolling itself, so overflow:hidden alone leaves the
     page still moving under the scrim. */
  var pop = document.querySelector('[data-pop]');
  if (pop) {
    var popTimer = setTimeout(openPop, 3000);
    var lastFocus = null;

    function openPop() {
      if (!pop.hidden) return;
      pop.hidden = false;
      pop.setAttribute('aria-hidden', 'false');
      lastFocus = document.activeElement;
      document.documentElement.classList.add('is-locked');
      if (lenis) lenis.stop();
      requestAnimationFrame(function () { pop.classList.add('is-on'); });
      var x = pop.querySelector('.pop__x');
      if (x) x.focus();
    }

    function closePop() {
      clearTimeout(popTimer);
      if (pop.hidden) return;
      pop.classList.remove('is-on');
      document.documentElement.classList.remove('is-locked');
      if (lenis) lenis.start();
      /* wait out the fade before pulling it from the layout, or it vanishes */
      setTimeout(function () {
        pop.hidden = true;
        pop.setAttribute('aria-hidden', 'true');
      }, reduce ? 0 : 450);
      if (lastFocus && lastFocus.focus) lastFocus.focus();
    }

    pop.addEventListener('click', function (e) {
      if (e.target.closest && e.target.closest('[data-pop-close]')) closePop();
    });
    /* Buying is closing: the link opens Patt in a new tab, so leaving the
       popup up behind it means they come back to a blocked page. */
    pop.addEventListener('click', function (e) {
      if (e.target.closest && e.target.closest('[data-buy]')) setTimeout(closePop, 120);
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') closePop();
    });
  }

  /* --- TABS -------------------------------------------------------------- */
  /* The three panes in Next Night's left frame. [hidden] does the switching so
     a pane is genuinely out of the layout, not just transparent: that is what
     keeps the map's IntersectionObserver from firing, so its 1.9 MB Google
     embed is not fetched until someone actually opens the Map tab. */
  var tabBar = document.querySelector('[data-tabs]');
  if (tabBar) {
    var btns = [].slice.call(tabBar.querySelectorAll('[data-tab]'));
    var panes = [].slice.call(document.querySelectorAll('[data-pane]'));
    function show(want) {
      btns.forEach(function (b) {
        var on = b.getAttribute('data-tab') === want;
        b.classList.toggle('is-on', on);
        b.setAttribute('aria-selected', on ? 'true' : 'false');
      });
      panes.forEach(function (p) {
        var on = p.getAttribute('data-pane') === want;
        p.classList.toggle('is-on', on);
        /* not [hidden]: these stay in the grid so the frame keeps its height.
           aria-hidden is what tells a screen reader which one is live. */
        p.setAttribute('aria-hidden', on ? 'false' : 'true');
      });
      /* The map is built on the first Map click, not by an observer: the pane
         is always laid out now, so an observer would fetch 1.9 MB of Google on
         page load. */
      if (want === 'map') {
        var box = document.querySelector('[data-map]');
        if (box && !box.dataset.loaded) {
          box.dataset.loaded = '1';
          var f = document.createElement('iframe');
          f.title = 'Map to the venue';
          f.referrerPolicy = 'no-referrer-when-downgrade';
          f.loading = 'lazy';
          f.scrolling = 'no';
          f.src = box.dataset.src;
          box.appendChild(f);
        }
      }
      /* The vinyl in the Music pane and the map in the Map pane both size
         themselves from a box that was display:none until now, so anything
         measured while hidden is wrong. Nudge the listeners that care. */
      window.dispatchEvent(new Event('resize'));
      if (window.ScrollTrigger) ScrollTrigger.refresh();
    }

    tabBar.addEventListener('click', function (e) {
      var btn = e.target.closest ? e.target.closest('[data-tab]') : null;
      if (btn) show(btn.getAttribute('data-tab'));
    });

    /* Anything else on the page can ask for a tab. The footer's "Find us" does,
       because the map moved in here and that link has to still mean something. */
    document.addEventListener('click', function (e) {
      var a = e.target.closest ? e.target.closest('[data-open-tab]') : null;
      if (a) show(a.getAttribute('data-open-tab'));
    });
  }

  /* --- HEADLINES -------------------------------------------------------- */
  /* Each <br> becomes its own masked line, so a headline rises in sequence. */
  document.querySelectorAll('[data-reveal]').forEach(function (el) {
    el.innerHTML = el.innerHTML.split(/<br\s*\/?>/i).map(function (l) {
      return '<span class="ln"><i>' + l.trim() + '</i></span>';
    }).join('');
    gsap.from(el.querySelectorAll('.ln i'), {
      yPercent: 105, duration: 1, ease: 'power3.out', stagger: .08,
      scrollTrigger: { trigger: el, start: 'top 88%', once: true }
    });
  });

  /* --- PANELS ----------------------------------------------------------- */
  gsap.utils.toArray('.cards, .records, .venue__grid, .stats').forEach(function (group) {
    gsap.from(group.children, {
      opacity: 0, y: 26, duration: .85, ease: 'power2.out', stagger: .08,
      scrollTrigger: { trigger: group, start: 'top 85%', once: true }
    });
  });

  gsap.utils.toArray('.lede').forEach(function (el) {
    gsap.from(el, {
      opacity: 0, y: 16, duration: .8, ease: 'power2.out',
      scrollTrigger: { trigger: el, start: 'top 90%', once: true }
    });
  });

  /* --- HERO ------------------------------------------------------------- */
  /* fromTo, not from: every end value is stated, so nothing can be inferred
     wrong and left sitting at zero. */
  function rise(sel, at, stagger) {
    return [sel, { opacity: 0, y: 14 },
      { opacity: 1, y: 0, duration: .8, stagger: stagger || 0, clearProps: 'transform' }, at];
  }
  var tl = gsap.timeline({ defaults: { ease: 'power3.out' } });
  tl.fromTo.apply(tl, rise('.hero__mark', 0))
    .fromTo.apply(tl, rise('.hero__slogan', 0.25))
    .fromTo.apply(tl, rise('.hero .pills li', 0.42, .06))
    .fromTo.apply(tl, rise('.hero__cta > *', 0.58, .08))
    .fromTo.apply(tl, rise('.nav__mark, .nav__links a, .nav .btn', 0.3, .05))
    .fromTo('.hero__down', { opacity: 0 }, { opacity: 1, duration: .6 }, 1.1);

  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(function () { ScrollTrigger.refresh(); });
  }
})();
