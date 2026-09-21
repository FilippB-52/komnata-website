/* ==========================================================================
   KØMNATA — backdrop
   A slow folded ribbon of light under heavy film grain. Raw WebGL2, no
   dependencies. One fixed full-viewport layer behind everything, so it spans
   the whole site rather than belonging to any section.

   Built to a reference Stas supplied. Measured off that image rather than
   eyeballed:
     highlight  #F0E8E6   (which is almost exactly the site's own bone)
     upper mid  #5C6061   cool grey, hue 192
     ground     near black, hue ~207
     saturation 5.7% mean, so: monochrome with a cool cast in the mids
     grain      stddev 14.8/255 in the midtones but only 2.6 in the blacks,
                so it rides the signal instead of sitting flat over everything

   The shape is domain-warped value noise: fbm of fbm of fbm. Taking a soft
   band around one contour of that field gives the folded ribbon, and warping
   the domain is what makes it fold back on itself instead of reading as
   clouds.

   Two passes. The field is expensive and runs at 1/scale resolution into a
   texture. The finish pass is cheap and runs at full device resolution, which
   is where the grain is applied, because grain has to be one device pixel to
   read as grain rather than as mush.

   Previous backgrounds, with restore instructions, are in the project's
   "Background versions" folder. Every knob is in CFG.
   ========================================================================== */
(function () {
  'use strict';

  var CFG = {
    /* The reference is a wallpaper, so its ribbon can go to near-white. This
       one has body copy sitting on it, so the core is pulled down: bone at a
       usable layer opacity leaves the lede text at roughly 1.5:1 against the
       ribbon, which is unreadable. See the contrast figures in the commit. */
    hi:    '#C9CECD',  // the ribbon core. The reference measured #F0E8E6
    mid:   '#5C6061',  // the cool grey wash around it, straight off the reference
    bg:    '#0B0C0D',  // page night

    level:   0.52,     // which contour of the field becomes the ribbon
    corePlateau: 0.055,// core is FULLY white out to here, then falls off to coreW.
                       // Without a plateau the core is a thin peak that never
                       // saturates: measured p90 122 against the reference's 192.
    coreW:   0.135,    // half-width at which the core has faded out entirely
    haloW:   0.34,     // half-width of the grey wash around it
    haloAmt: 0.60,     // how strong that wash gets

    /* Texture, reworked from per-pixel grain to drifting smoke.

       The first version hashed every device pixel and reshuffled it 8 times a
       second. That is film grain, and at this density it read as a screenful
       of glitching pixels rather than as a material. Smoke is the opposite:
       low spatial frequency, and it FLOWS instead of being resampled.

       So the texture is now smooth two-octave value noise whose sample point
       drifts, monochrome rather than per-channel (coloured speckle reads as
       digital noise, a luminance mottle reads as a material). A 1/255 dither
       stays on top, because the near-black gradients still band without it,
       but that one is a single step and invisible. */
    grain:     0.085,  // amplitude at full signal
    grainFloor: 0.022, // fraction surviving into the blacks. The reference's
                       // shadows are almost clean: stddev 1.1 against 14.8 in
                       // the midtones, so the texture rides the light.
    grainSize: 3.4,    // device pixels per noise cell. Larger = softer, smokier
    grainDrift: 7.0,   // device pixels a second the mottle travels

    /* Cost. Field work is canvas px / scale^2. dpr is 2 so the GRAIN is one
       device pixel, and scale absorbs it so the field pass costs the same as
       it did at dpr 1 scale 3. */
    /* 9, not 6. This shader is about 80 hash ops a pixel (five fbm calls of
       four octaves) where the previous one was 36 simple iterations, and at
       scale 6 a 1440x900 desktop measured an 83ms median frame against the
       old build's 33ms, alternating samples under equal machine load. The
       form is heavily blurred and the grain is applied at FULL resolution
       afterwards, so dropping the field resolution costs nothing you can see. */
    scale: 9,
    dpr: 2,
    fps: 30,

    zoom: 0.60,        // how much of the field fits on screen. Lower = larger forms.
                       // Below about 0.5 the contour stops crossing the view at all
                       // and the frame goes entirely black.
    speed: 0.40,       // how fast it folds
    wanderAmp: 0.55,   // how far it travels across the screen
    wanderSpin: 0.20,  // radians of slow rotation on top of the travel

    hover: 0.40,       // pointer influence. 0 turns interaction off
    reachPx: 260,
    twist: 0.45,
    drag: 0.06
  };

  var host = document.querySelector('[data-backdrop]');
  if (!host) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  var canvas = host.querySelector('canvas');
  if (!canvas) return;

  var gl = canvas.getContext('webgl2', {
    antialias: false, alpha: false, depth: false, stencil: false,
    powerPreference: 'low-power'
  });
  if (!gl) return;

  /* --- shaders ----------------------------------------------------------- */
  var VERT = '#version 300 es\n' +
    'const vec2 P[3] = vec2[3](vec2(-1.0,-1.0), vec2(3.0,-1.0), vec2(-1.0,3.0));\n' +
    'void main(){ gl_Position = vec4(P[gl_VertexID], 0.0, 1.0); }\n';

  var FIELD =
    '#version 300 es\n' +
    'precision highp float;\n' +
    'uniform vec2 uRes; uniform float uTime;\n' +
    'uniform vec3 uHi; uniform vec3 uMid; uniform vec3 uBg;\n' +
    'uniform vec2 uMouse; uniform float uOn; uniform float uReach; uniform vec2 uVel;\n' +
    'uniform float uZoom; uniform float uWander; uniform float uSpin;\n' +
    'uniform float uLevel; uniform float uCoreIn; uniform float uCoreW; uniform float uHaloW; uniform float uHaloAmt;\n' +
    'out vec4 o;\n' +
    'const float TWIST = ' + CFG.twist.toFixed(3) + ';\n' +
    'const float DRAG  = ' + CFG.drag.toFixed(3) + ';\n' +
    'mat2 rot(float a){ float c=cos(a), s=sin(a); return mat2(c,s,-s,c); }\n' +

    'float hash21(vec2 p){\n' +
    '  p = fract(p * vec2(123.34, 456.21));\n' +
    '  p += dot(p, p + 45.32);\n' +
    '  return fract(p.x * p.y);\n' +
    '}\n' +
    /* value noise, smoothstep-interpolated. Cheaper than simplex and the
       difference disappears entirely once four octaves are stacked. */
    'float vnoise(vec2 p){\n' +
    '  vec2 i = floor(p), f = fract(p);\n' +
    '  f = f * f * (3.0 - 2.0 * f);\n' +
    '  float a = hash21(i), b = hash21(i + vec2(1.0,0.0));\n' +
    '  float c = hash21(i + vec2(0.0,1.0)), d = hash21(i + vec2(1.0,1.0));\n' +
    '  return mix(mix(a,b,f.x), mix(c,d,f.x), f.y);\n' +
    '}\n' +
    'float fbm(vec2 p){\n' +
    '  float s = 0.0, a = 0.5;\n' +
    '  for (int i = 0; i < 4; i++){ s += a * vnoise(p); p = p * 2.03 + 17.1; a *= 0.5; }\n' +
    '  return s;\n' +
    '}\n' +

    'void main(){\n' +
    '  vec2 R = uRes;\n' +
    '  vec2 pos = (gl_FragCoord.xy - 0.5*R) / R.y;\n' +
    /* pointer: a local rotation that falls off with distance, plus a smear
       from how fast the cursor is moving */
    '  vec2 dm = pos - uMouse;\n' +
    '  float w = uOn * exp(-dot(dm,dm)/(uReach*uReach));\n' +
    '  if (w > 1e-4) pos = uMouse + rot(w*TWIST)*dm*(1.0 - 0.3*min(w,1.0)) - uVel*min(w,1.0)*DRAG;\n' +
    '  pos = rot(sin(uTime*0.031) * uSpin) * pos;\n' +
    '  vec2 wander = vec2(sin(uTime*0.071), cos(uTime*0.053)) * uWander;\n' +
    '  vec2 p = pos * uZoom + wander;\n' +

    /* domain warping, three levels. This is what folds the ribbon back over
       itself; one level alone just reads as clouds. */
    '  float t = uTime * 0.22;\n' +
    '  vec2 q = vec2(fbm(p + vec2(0.0, 0.0) + t*0.30),\n' +
    '                fbm(p + vec2(3.1, 7.4) - t*0.24));\n' +
    '  vec2 r = vec2(fbm(p + 3.0*q + vec2(1.7, 9.2) + t*0.17),\n' +
    '                fbm(p + 3.0*q + vec2(8.3, 2.8) - t*0.13));\n' +
    '  float f = fbm(p + 3.2*r);\n' +

    /* a soft band around one contour of the field: the ribbon */
    '  float d = abs(f - uLevel);\n' +
    '  float core = 1.0 - smoothstep(uCoreIn, uCoreW, d);\n' +
    '  float halo = 1.0 - smoothstep(0.0, uHaloW, d);\n' +
    '  halo = halo * halo;\n' +
    '  vec3 col = mix(uBg, uMid, clamp(halo * uHaloAmt, 0.0, 1.0));\n' +
    '  col = mix(col, uHi, core);\n' +
    /* the reference is darkest at the top and opens up lower down */
    '  col *= 1.0 - smoothstep(0.30, 1.25, length(pos)) * 0.30;\n' +
    '  o = vec4(col, 1.0);\n' +
    '}\n';

  var FINISH =
    '#version 300 es\n' +
    'precision highp float;\n' +
    'uniform sampler2D uField; uniform vec2 uRes; uniform float uTime;\n' +
    'uniform float uGrain; uniform float uFloor; uniform float uGSize; uniform float uGDrift;\n' +
    'out vec4 o;\n' +
    'float hash21(vec2 p){\n' +
    '  p = fract(p * vec2(123.34, 456.21));\n' +
    '  p += dot(p, p + 45.32);\n' +
    '  return fract(p.x * p.y);\n' +
    '}\n' +
    'float vnoise(vec2 p){\n' +
    '  vec2 i = floor(p), f = fract(p);\n' +
    '  f = f * f * (3.0 - 2.0 * f);\n' +
    '  float a = hash21(i), b = hash21(i + vec2(1.0,0.0));\n' +
    '  float c = hash21(i + vec2(0.0,1.0)), d = hash21(i + vec2(1.0,1.0));\n' +
    '  return mix(mix(a,b,f.x), mix(c,d,f.x), f.y);\n' +
    '}\n' +
    'void main(){\n' +
    '  vec2 frag = gl_FragCoord.xy;\n' +
    '  vec3 col = texture(uField, frag / uRes).rgb;\n' +
    /* Grain at ONE DEVICE PIXEL, which is the whole point of running this pass
       at full resolution. It rides the signal: measured on the reference,
       stddev is 14.8/255 in the midtones and 2.6 in the blacks, so flat grain
       over the whole frame would be wrong. Three decorrelated samples so the
       grain is coloured rather than a grey veil, which is what the reference
       does. */
    '  float lum = dot(col, vec3(0.2126, 0.7152, 0.0722));\n' +
    '  float amt = uGrain * (uFloor + (1.0 - uFloor) * sqrt(clamp(lum, 0.0, 1.0)));\n' +
    /* two octaves drifting in different directions, so the mottle folds through
       itself instead of sliding across the screen as one sheet */
    '  vec2 gp = frag / uGSize;\n' +
    '  vec2 dr = vec2(uTime * uGDrift, uTime * -uGDrift * 0.7) / uGSize;\n' +
    '  float n = vnoise(gp + dr) * 0.66 + vnoise(gp * 2.17 - dr * 1.4) * 0.34;\n' +
    '  col += (n - 0.5) * amt * 2.0;\n' +
    /* one step of dither, which is all the near-black gradients need to stop
       banding, and far too fine to read as texture */
    '  col += (hash21(frag * 1.37) - 0.5) / 255.0;\n' +
    '  o = vec4(clamp(col, 0.0, 1.0), 1.0);\n' +
    '}\n';

  function compile(type, src, label) {
    var sh = gl.createShader(type);
    gl.shaderSource(sh, src); gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
      console.error('backdrop ' + label + ':', gl.getShaderInfoLog(sh));
      gl.deleteShader(sh); return null;
    }
    return sh;
  }
  function link(fragSrc, label) {
    var vs = compile(gl.VERTEX_SHADER, VERT, label + ' vert');
    var fs = compile(gl.FRAGMENT_SHADER, fragSrc, label + ' frag');
    if (!vs || !fs) return null;
    var pr = gl.createProgram();
    gl.attachShader(pr, vs); gl.attachShader(pr, fs); gl.linkProgram(pr);
    gl.deleteShader(vs); gl.deleteShader(fs);
    if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) {
      console.error('backdrop ' + label + ' link:', gl.getProgramInfoLog(pr));
      gl.deleteProgram(pr); return null;
    }
    return pr;
  }
  function uniforms(pr, names) {
    var u = {}, i;
    for (i = 0; i < names.length; i++) u[names[i]] = gl.getUniformLocation(pr, names[i]);
    return u;
  }

  var fieldProg = link(FIELD, 'field');
  var finishProg = link(FINISH, 'finish');
  if (!fieldProg || !finishProg) return;

  var uF = uniforms(fieldProg, ['uRes','uTime','uHi','uMid','uBg','uMouse','uOn','uReach','uVel',
                                'uZoom','uWander','uSpin','uLevel','uCoreIn','uCoreW','uHaloW','uHaloAmt']);
  var uN = uniforms(finishProg, ['uField','uRes','uTime','uGrain','uFloor','uGSize','uGDrift']);

  var vao = gl.createVertexArray();
  gl.bindVertexArray(vao);

  /* --- reduced-resolution render target ---------------------------------- */
  var fbo = gl.createFramebuffer(), tex = null, fw = 0, fh = 0;

  function resizeTarget(w, h) {
    if (w === fw && h === fh && tex) return;
    if (tex) gl.deleteTexture(tex);
    tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    fw = w; fh = h;
  }

  function rgb(hex) {
    var h = hex.replace('#', '');
    return [parseInt(h.slice(0,2),16)/255, parseInt(h.slice(2,4),16)/255, parseInt(h.slice(4,6),16)/255];
  }
  var HI = rgb(CFG.hi), MID = rgb(CFG.mid), BG = rgb(CFG.bg);

  /* --- pointer ----------------------------------------------------------- */
  /* Touch is ignored on purpose: a finger is already busy scrolling. */
  var ptrX = 0, ptrY = 0, ptrSeen = false, ptrIn = false;
  function readPointer(e) {
    if (e.pointerType === 'touch') return;
    ptrX = e.clientX; ptrY = e.clientY; ptrSeen = true; ptrIn = true;
  }
  window.addEventListener('pointermove', readPointer, { passive: true });
  window.addEventListener('pointerdown', readPointer, { passive: true });
  document.addEventListener('pointerout', function (e) { if (!e.relatedTarget) ptrIn = false; });

  /* --- loop -------------------------------------------------------------- */
  var mx = 0, my = 0, vx = 0, vy = 0, on = 0;
  var raf = 0, last = -1, clock = 0, prevFrame = 0;
  var running = false, wanted = false;

  function frame(now) {
    if (!running) return;
    raf = requestAnimationFrame(frame);
    if (now - prevFrame < 1000 / CFG.fps) return;
    var dt = last < 0 ? 0 : Math.min((now - last) / 1000, 0.05);
    last = now; prevFrame = now;
    clock = (clock + dt * CFG.speed) % 3600;

    var dpr = Math.min(window.devicePixelRatio || 1, CFG.dpr);
    var cw = canvas.clientWidth || 1, ch = canvas.clientHeight || 1;
    var bw = Math.max(1, Math.round(cw * dpr)), bh = Math.max(1, Math.round(ch * dpr));
    if (canvas.width !== bw || canvas.height !== bh) { canvas.width = bw; canvas.height = bh; }
    resizeTarget(Math.max(1, Math.round(bw / CFG.scale)), Math.max(1, Math.round(bh / CFG.scale)));

    var present = (ptrSeen && ptrIn) ? 1 : 0;
    if (present && on < 0.02) { mx = ptrX; my = ptrY; }
    on += (present - on) * (1 - Math.exp(-dt * 5));
    var k = 1 - Math.exp(-dt * 16);
    var nx = mx + (ptrX - mx) * k, ny = my + (ptrY - my) * k;
    if (dt > 0) {
      var kv = 1 - Math.exp(-dt * 8);
      vx += ((nx - mx) / dt - vx) * kv;
      vy += ((ny - my) / dt - vy) * kv;
    }
    mx = nx; my = ny;
    var vLen = Math.hypot(vx, vy) / ch;
    var vCap = vLen > 3 ? 3 / vLen : 1;

    gl.bindVertexArray(vao);
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.viewport(0, 0, fw, fh);
    gl.useProgram(fieldProg);
    gl.uniform2f(uF.uRes, fw, fh);
    gl.uniform1f(uF.uTime, clock);
    gl.uniform3f(uF.uHi, HI[0], HI[1], HI[2]);
    gl.uniform3f(uF.uMid, MID[0], MID[1], MID[2]);
    gl.uniform3f(uF.uBg, BG[0], BG[1], BG[2]);
    gl.uniform2f(uF.uMouse, (mx - cw / 2) / ch, (ch / 2 - my) / ch);
    gl.uniform1f(uF.uOn, on * CFG.hover);
    gl.uniform1f(uF.uReach, CFG.reachPx / ch);
    gl.uniform2f(uF.uVel, (vx / ch) * vCap, (-vy / ch) * vCap);
    gl.uniform1f(uF.uZoom, CFG.zoom);
    gl.uniform1f(uF.uWander, CFG.wanderAmp);
    gl.uniform1f(uF.uSpin, CFG.wanderSpin);
    gl.uniform1f(uF.uLevel, CFG.level);
    gl.uniform1f(uF.uCoreIn, CFG.corePlateau);
    gl.uniform1f(uF.uCoreW, CFG.coreW);
    gl.uniform1f(uF.uHaloW, CFG.haloW);
    gl.uniform1f(uF.uHaloAmt, CFG.haloAmt);
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, bw, bh);
    gl.useProgram(finishProg);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.uniform1i(uN.uField, 0);
    gl.uniform2f(uN.uRes, bw, bh);
    gl.uniform1f(uN.uTime, now / 1000);
    gl.uniform1f(uN.uGrain, CFG.grain);
    gl.uniform1f(uN.uFloor, CFG.grainFloor);
    gl.uniform1f(uN.uGSize, CFG.grainSize);
    gl.uniform1f(uN.uGDrift, CFG.grainDrift);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  function start() {
    if (running) return;
    running = true; last = -1; prevFrame = 0;
    raf = requestAnimationFrame(frame);
  }
  function stop() { running = false; cancelAnimationFrame(raf); }

  document.addEventListener('visibilitychange', function () {
    if (document.hidden) stop(); else if (wanted) start();
  });

  window.KomnataBackdrop = {
    setVisible: function (v) { wanted = v; if (v && !document.hidden) start(); else stop(); },
    start: start,
    stop: stop,
    isRunning: function () { return running; },
    cost: function () { return { fieldPx: fw * fh, canvasPx: canvas.width * canvas.height }; },
    config: CFG
  };
})();
