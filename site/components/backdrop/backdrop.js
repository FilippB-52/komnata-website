/* ==========================================================================
   KØMNATA — backdrop
   A drifting ribbon field in the brand cyan, drawn in raw WebGL2. It is the
   page's background: one fixed full-viewport layer behind everything, so it
   spans the whole site rather than belonging to any section.

   Replaces the Three.js beams. Nothing else on the site used Three, so that
   209 KB CDN script went with it. The previous version and the instructions
   to put it back are in "Background versions/01 - beams (Three.js)/".

   Two passes. The field is drawn at half resolution into a texture, then a
   cheap full-resolution pass composites it over the page colour and adds a
   dither so the very dark gradients do not band. The expensive loop therefore
   runs over a quarter of the pixels.

   Every knob is in CFG.
   ========================================================================== */
(function () {
  'use strict';

  var CFG = {
    c1: '#8DEEED',     // brand cyan
    c2: '#256F6E',     // the second brand teal, the darker one
    bg: '#0B0C0D',     // page night, what the field is composited over

    /* gain and sat trade against each other, measured: the tonemap desaturates
       as it is driven harder, so brightness bought here costs colour.
         gain .62 sat 1.55 -> brightest ribbons  9% saturated
         gain .62 sat 2.4  -> 14%
         gain .40 sat 2.4  -> 22%
         gain .40 sat 3.2  -> 31%
       So colour is taken from the shader at a modest gain, and presence is
       taken from the layer opacity in main.js instead, which is a straight
       composite and does not touch saturation. */
    gain: 0.42,        // overall brightness of the field itself
    sat: 3.0,          // vibrance, applied after the tonemap. The brand cyan is
                       // a pale one (74% lightness), so it greys out fast when
                       // pushed; this pushes each pixel back off its own grey.
    /* The three cost knobs. Field work is layers x (canvas px / scale^2), and
       the canvas is sized by dpr, so these multiply. Measured before tuning:
       56 layers, scale 2, dpr 2 put a 1440x900 desktop at a 166ms median
       frame, about 6fps. See the sweep in the commit that set these. */
    layers: 36,        // ribbons accumulated per pixel. The single biggest cost.
    scale: 3,          // field is rendered at 1/scale of the canvas, then upscaled
    dpr: 1,            // a soft glow does not need retina. The old beams also ran at 1.
    fps: 30,           // the drift is slow, 30 is indistinguishable from 60 here

    size: 1.0,
    angle: -Math.PI,
    speed: 0.62,

    /* Pointer influence, turned well down on request. It should read as the
       field noticing the cursor, not being shoved by it. */
    hover: 0.40,       // 0 turns interaction off entirely
    reachPx: 260,      // how far from the cursor the warp reaches, in px
    twist: 0.45,       // how much the field rotates under the cursor
    drag: 0.06,        // how much a fast cursor smears it

    /* Slow travel across the screen, so the field does not just churn in
       place. Two incommensurate frequencies, so the path never visibly
       repeats. wanderAmp is in the shader's own units, where 1.0 is about
       one viewport height. */
    wanderAmp: 0.42,
    wanderSpin: 0.22   // radians of slow rotation on top of the travel
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
  if (!gl) return;                       // no WebGL2: the page just stays black

  /* --- shaders ----------------------------------------------------------- */
  /* One full-screen triangle from gl_VertexID. No buffers, no attributes. */
  var VERT = '#version 300 es\n' +
    'const vec2 P[3] = vec2[3](vec2(-1.0,-1.0), vec2(3.0,-1.0), vec2(-1.0,3.0));\n' +
    'void main(){ gl_Position = vec4(P[gl_VertexID], 0.0, 1.0); }\n';

  var FIELD =
    '#version 300 es\n' +
    'precision highp float;\n' +
    'uniform vec2 uRes; uniform float uTime; uniform vec3 uC1; uniform vec3 uC2;\n' +
    'uniform float uSize; uniform float uAngle; uniform vec2 uMouse; uniform float uOn;\n' +
    'uniform float uReach; uniform vec2 uVel; uniform float uGain; uniform float uSat;\n' +
    'uniform float uWander; uniform float uSpin;\n' +
    'out vec4 o;\n' +
    'const float LAYERS = ' + CFG.layers.toFixed(1) + ';\n' +
    'const float TWIST  = ' + CFG.twist.toFixed(3) + ';\n' +
    'const float DRAG   = ' + CFG.drag.toFixed(3) + ';\n' +
    'const vec2  CENTRE = vec2(-0.62, 0.24);\n' +
    'const float TILT = 0.6; const float ZOOM = 1.05;\n' +
    'const float THETA = 2.13; const float SHEAR = 0.963; const float SHRINK = 0.953;\n' +
    'const vec2 WARP_FREQ = vec2(0.42, 2.4); const vec2 WARP_AMP = vec2(0.13, 0.027);\n' +
    'const vec2 ASPECT = vec2(2.1, 0.17); const float OFFSET = 0.36;\n' +
    'const float GLOW = 0.0021; const float SOFT = 0.0019; const float FALLOFF = 0.37;\n' +
    'const float PHASE = 12.0; const float CYCLE = 0.16; const float HUE_TRAVEL = 2.0;\n' +
    'mat2 rot(float a){ float c=cos(a), s=sin(a); return mat2(c,s,-s,c); }\n' +
    'void main(){\n' +
    '  vec2 R = uRes;\n' +
    '  vec2 pos = (gl_FragCoord.xy - 0.5*R) / R.y;\n' +
    '  vec2 d = pos - uMouse;\n' +
    '  float w = uOn * exp(-dot(d,d)/(uReach*uReach));\n' +
    '  if (w > 1e-4) pos = uMouse + rot(w*TWIST)*d*(1.0 - 0.3*min(w,1.0)) - uVel*min(w,1.0)*DRAG;\n' +
    /* the slow travel: the whole field wanders and turns, so a given ribbon
       crosses the screen over minutes rather than sitting in one place */
    '  pos = rot(uAngle + sin(uTime*0.031)*uSpin) * pos / uSize;\n' +
    '  float t = uTime * 0.49 + PHASE;\n' +
    '  float breath = (-sin(uTime*0.735) + sin(uTime*0.49 + 1.0)) * 0.25 + 0.5;\n' +
    '  vec2 wander = vec2(sin(uTime*0.071), cos(uTime*0.053)) * uWander;\n' +
    '  vec2 u = rot(TILT) * ((pos - CENTRE - wander) * (ZOOM - breath*0.085));\n' +
    '  mat2 fold = mat2(cos(THETA), sin(THETA), -SHEAR, cos(THETA));\n' +
    '  vec3 col = vec3(0.0);\n' +
    '  for (float i = 1.0; i <= LAYERS; i += 1.0) {\n' +
    '    u.x -= sin(u.y*WARP_FREQ.x + t + i*0.007) * WARP_AMP.x;\n' +
    '    u.y -= sin(u.x*WARP_FREQ.y - t + i*0.02) * WARP_AMP.y;\n' +
    '    u = fold * u * SHRINK;\n' +
    '    vec2 q = (u - vec2(OFFSET + breath*0.1, 0.0)) * ASPECT;\n' +
    '    float g = GLOW / (dot(q,q) + SOFT) * (0.25 + breath*0.4);\n' +
    '    float r = length(u);\n' +
    '    float k = sin(i*CYCLE + t*1.2 + r*HUE_TRAVEL) * 0.5 + 0.5;\n' +
    '    col += g * mix(uC1, uC2, k) * (0.62 + 0.5*k) * exp2(-r*FALLOFF);\n' +
    '  }\n' +
    /* ACES-ish tonemap, then a gentle gamma per channel, straight from the
       reference. Without it the bright cores clip to white and the cyan goes
       grey exactly where it should be most saturated. */
    '  vec3 x = max(col * uGain, 0.0);\n' +
    '  col = (x*(2.51*x + 0.03)) / (x*(2.43*x + 0.59) + 0.14);\n' +
    '  col = pow(clamp(col, 0.0, 1.0), vec3(0.85, 0.92, 0.98));\n' +
    '  col = mix(vec3(dot(col, vec3(0.2126, 0.7152, 0.0722))), col, uSat);\n' +
    /* Gentle. An earlier 0.35 at 0.45 darkened the edges so hard it ate the
       ribbons, which sit off-centre by design (CENTRE is -0.62, 0.24). This
       only stops the layer ending on a hard rectangle. */
    '  col *= 1.0 - smoothstep(0.55, 1.7, length(pos)) * 0.18;\n' +
    '  o = vec4(col, 1.0);\n' +
    '}\n';

  var FINISH =
    '#version 300 es\n' +
    'precision highp float;\n' +
    'uniform sampler2D uField; uniform vec2 uRes; uniform float uTime; uniform vec3 uBg;\n' +
    'out vec4 o;\n' +
    /* interleaved gradient noise, one 1/255 step of dither. At these
       brightnesses 8-bit output bands visibly without it. */
    'float ign(vec2 p, float f){ p += 5.588238*mod(f,64.0);\n' +
    '  return fract(52.9829189*fract(0.06711056*p.x + 0.00583715*p.y)); }\n' +
    'void main(){\n' +
    '  vec2 frag = gl_FragCoord.xy;\n' +
    '  vec3 L = max(texture(uField, frag/uRes).rgb, 0.0);\n' +
    '  vec3 col = uBg + L * (1.0 - uBg);\n' +
    '  col += (ign(frag, floor(uTime*24.0)) - 0.5) / 255.0;\n' +
    '  o = vec4(clamp(col, 0.0, 1.0), 1.0);\n' +
    '}\n';

  function compile(type, src, label) {
    var sh = gl.createShader(type);
    gl.shaderSource(sh, src);
    gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
      console.error('backdrop ' + label + ':', gl.getShaderInfoLog(sh));
      gl.deleteShader(sh);
      return null;
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
      gl.deleteProgram(pr);
      return null;
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

  var uF = uniforms(fieldProg, ['uRes','uTime','uC1','uC2','uSize','uAngle','uMouse','uOn','uReach','uVel','uGain','uSat','uWander','uSpin']);
  var uN = uniforms(finishProg, ['uField','uRes','uTime','uBg']);

  var vao = gl.createVertexArray();
  gl.bindVertexArray(vao);

  /* --- half-resolution render target ------------------------------------- */
  var fbo = gl.createFramebuffer(), tex = null, fw = 0, fh = 0;
  var wantHalfFloat = !!gl.getExtension('EXT_color_buffer_float');

  function resizeTarget(w, h) {
    if (w === fw && h === fh && tex) return;
    for (var attempt = 0; attempt < 2; attempt++) {
      if (tex) gl.deleteTexture(tex);
      tex = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texImage2D(gl.TEXTURE_2D, 0, wantHalfFloat ? gl.RGBA16F : gl.RGBA8,
                    w, h, 0, gl.RGBA, wantHalfFloat ? gl.HALF_FLOAT : gl.UNSIGNED_BYTE, null);
      gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
      var ok = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE;
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      if (ok || !wantHalfFloat) break;
      wantHalfFloat = false;            // some mobile GPUs advertise it and fail
    }
    fw = w; fh = h;
  }

  /* --- colour ------------------------------------------------------------ */
  function rgb(hex) {
    var h = hex.replace('#', '');
    return [parseInt(h.slice(0,2),16)/255, parseInt(h.slice(2,4),16)/255, parseInt(h.slice(4,6),16)/255];
  }
  var C1 = rgb(CFG.c1), C2 = rgb(CFG.c2), BG = rgb(CFG.bg);

  /* --- pointer ----------------------------------------------------------- */
  /* The layer is pointer-events:none and sits under everything, so it can
     never receive an event itself. Track on window and convert to layer
     coordinates, which is what the reference does too. Touch is ignored on
     purpose: a finger is already busy scrolling. */
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
  var step = 1000 / CFG.fps;
  var running = false, wanted = false;

  function frame(now) {
    if (!running) return;
    raf = requestAnimationFrame(frame);
    if (now - prevFrame < step) return;
    var dt = last < 0 ? 0 : Math.min((now - last) / 1000, 0.05);
    last = now; prevFrame = now;
    clock = (clock + dt * CFG.speed) % 3600;

    var dpr = Math.min(window.devicePixelRatio || 1, CFG.dpr);
    var cw = canvas.clientWidth || 1;
    var ch = canvas.clientHeight || 1;
    var bw = Math.max(1, Math.round(cw * dpr));
    var bh = Math.max(1, Math.round(ch * dpr));
    if (canvas.width !== bw || canvas.height !== bh) { canvas.width = bw; canvas.height = bh; }
    resizeTarget(Math.max(1, Math.round(bw / CFG.scale)), Math.max(1, Math.round(bh / CFG.scale)));

    var present = (ptrSeen && ptrIn) ? 1 : 0;
    if (present && on < 0.02) { mx = ptrX; my = ptrY; }
    on += (present - on) * (1 - Math.exp(-dt * 5));
    var k = 1 - Math.exp(-dt * 16);
    var nx = mx + (ptrX - mx) * k;
    var ny = my + (ptrY - my) * k;
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
    gl.uniform3f(uF.uC1, C1[0], C1[1], C1[2]);
    gl.uniform3f(uF.uC2, C2[0], C2[1], C2[2]);
    gl.uniform1f(uF.uSize, CFG.size);
    gl.uniform1f(uF.uAngle, CFG.angle);
    gl.uniform1f(uF.uGain, CFG.gain);
    gl.uniform1f(uF.uSat, CFG.sat);
    gl.uniform1f(uF.uWander, CFG.wanderAmp);
    gl.uniform1f(uF.uSpin, CFG.wanderSpin);
    gl.uniform2f(uF.uMouse, (mx - cw / 2) / ch, (ch / 2 - my) / ch);
    gl.uniform1f(uF.uOn, on * CFG.hover);
    gl.uniform1f(uF.uReach, CFG.reachPx / ch);
    gl.uniform2f(uF.uVel, (vx / ch) * vCap, (-vy / ch) * vCap);
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, bw, bh);
    gl.useProgram(finishProg);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.uniform1i(uN.uField, 0);
    gl.uniform2f(uN.uRes, bw, bh);
    gl.uniform1f(uN.uTime, clock);
    gl.uniform3f(uN.uBg, BG[0], BG[1], BG[2]);
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
    setVisible: function (v) {
      wanted = v;
      if (v && !document.hidden) start(); else stop();
    },
    start: start,
    stop: stop,
    isRunning: function () { return running; },
    /* what the field pass is actually chewing each frame, for tuning */
    cost: function () { return { fieldPx: fw * fh, layers: CFG.layers, iterations: fw * fh * CFG.layers }; },
    config: CFG
  };
})();
