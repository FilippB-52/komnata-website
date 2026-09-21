/* ==========================================================================
   KØMNATA — beams
   A vanilla Three.js port of the react-three-fiber Beams component.

   What it is: a set of tall flat planes standing side by side, each one
   displaced along Z by 3D Perlin noise that scrolls with time. Lit by a single
   directional light, the ridges catch the light and read as ribbons drifting
   across the frame.

   Differences from the React original, all deliberate:
   - two fields instead of one, mirrored about the vertical and running their
     noise in opposite directions, so the ribbons cross rather than all sliding
     the same way
   - near-horizontal (the original stands them upright)
   - the beams are much longer than the original's 15 units, because once they
     are laid on their side that length becomes the width of the screen
   - it renders at dpr 1 and stops entirely when the tab is hidden or the
     layer is scrolled past

   Everything tunable is in CFG at the top.
   ========================================================================== */
(function () {
  'use strict';

  var CFG = {
    tilt: 84,            // degrees. 90 would be dead horizontal, this leans it slightly
    beams: 10,
    beamWidth: 2.6,      // the camera sees about 10.7 world units top to bottom, so this
                         // puts roughly four beams across the screen, as in the original
    beamLength: 50,      // becomes the horizontal run once tilted
    segments: 60,
    speed: 2,
    noiseIntensity: 1.75,
    scale: 0.2,
    light: '#8DEEED',    // brand cyan. '#EFECE6' for bone, '#ffffff' for plain white
    beamColor: '#000000',
    intensity: 0.95,
    dpr: 1,              // a soft background does not need retina, and this is 4x cheaper
    fps: 30              // the drift is slow enough that 30 is indistinguishable from 60
  };

  var host = document.querySelector('[data-beams]');
  if (!host || typeof THREE === 'undefined') return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  /* --- the noise the shader needs -------------------------------------- */
  var NOISE = [
    'float random (in vec2 st) { return fract(sin(dot(st.xy, vec2(12.9898,78.233))) * 43758.5453123); }',
    'float noise (in vec2 st) {',
    '  vec2 i = floor(st); vec2 f = fract(st);',
    '  float a = random(i); float b = random(i + vec2(1.0, 0.0));',
    '  float c = random(i + vec2(0.0, 1.0)); float d = random(i + vec2(1.0, 1.0));',
    '  vec2 u = f * f * (3.0 - 2.0 * f);',
    '  return mix(a, b, u.x) + (c - a) * u.y * (1.0 - u.x) + (d - b) * u.x * u.y;',
    '}',
    'vec4 permute(vec4 x){return mod(((x*34.0)+1.0)*x, 289.0);}',
    'vec4 taylorInvSqrt(vec4 r){return 1.79284291400159 - 0.85373472095314 * r;}',
    'vec3 fade(vec3 t) {return t*t*t*(t*(t*6.0-15.0)+10.0);}',
    'float cnoise(vec3 P){',
    '  vec3 Pi0 = floor(P); vec3 Pi1 = Pi0 + vec3(1.0);',
    '  Pi0 = mod(Pi0, 289.0); Pi1 = mod(Pi1, 289.0);',
    '  vec3 Pf0 = fract(P); vec3 Pf1 = Pf0 - vec3(1.0);',
    '  vec4 ix = vec4(Pi0.x, Pi1.x, Pi0.x, Pi1.x);',
    '  vec4 iy = vec4(Pi0.yy, Pi1.yy); vec4 iz0 = Pi0.zzzz; vec4 iz1 = Pi1.zzzz;',
    '  vec4 ixy = permute(permute(ix) + iy);',
    '  vec4 ixy0 = permute(ixy + iz0); vec4 ixy1 = permute(ixy + iz1);',
    '  vec4 gx0 = ixy0 / 7.0; vec4 gy0 = fract(floor(gx0) / 7.0) - 0.5; gx0 = fract(gx0);',
    '  vec4 gz0 = vec4(0.5) - abs(gx0) - abs(gy0); vec4 sz0 = step(gz0, vec4(0.0));',
    '  gx0 -= sz0 * (step(0.0, gx0) - 0.5); gy0 -= sz0 * (step(0.0, gy0) - 0.5);',
    '  vec4 gx1 = ixy1 / 7.0; vec4 gy1 = fract(floor(gx1) / 7.0) - 0.5; gx1 = fract(gx1);',
    '  vec4 gz1 = vec4(0.5) - abs(gx1) - abs(gy1); vec4 sz1 = step(gz1, vec4(0.0));',
    '  gx1 -= sz1 * (step(0.0, gx1) - 0.5); gy1 -= sz1 * (step(0.0, gy1) - 0.5);',
    '  vec3 g000 = vec3(gx0.x,gy0.x,gz0.x); vec3 g100 = vec3(gx0.y,gy0.y,gz0.y);',
    '  vec3 g010 = vec3(gx0.z,gy0.z,gz0.z); vec3 g110 = vec3(gx0.w,gy0.w,gz0.w);',
    '  vec3 g001 = vec3(gx1.x,gy1.x,gz1.x); vec3 g101 = vec3(gx1.y,gy1.y,gz1.y);',
    '  vec3 g011 = vec3(gx1.z,gy1.z,gz1.z); vec3 g111 = vec3(gx1.w,gy1.w,gz1.w);',
    '  vec4 norm0 = taylorInvSqrt(vec4(dot(g000,g000),dot(g010,g010),dot(g100,g100),dot(g110,g110)));',
    '  g000 *= norm0.x; g010 *= norm0.y; g100 *= norm0.z; g110 *= norm0.w;',
    '  vec4 norm1 = taylorInvSqrt(vec4(dot(g001,g001),dot(g011,g011),dot(g101,g101),dot(g111,g111)));',
    '  g001 *= norm1.x; g011 *= norm1.y; g101 *= norm1.z; g111 *= norm1.w;',
    '  float n000 = dot(g000, Pf0); float n100 = dot(g100, vec3(Pf1.x,Pf0.yz));',
    '  float n010 = dot(g010, vec3(Pf0.x,Pf1.y,Pf0.z)); float n110 = dot(g110, vec3(Pf1.xy,Pf0.z));',
    '  float n001 = dot(g001, vec3(Pf0.xy,Pf1.z)); float n101 = dot(g101, vec3(Pf1.x,Pf0.y,Pf1.z));',
    '  float n011 = dot(g011, vec3(Pf0.x,Pf1.yz)); float n111 = dot(g111, Pf1);',
    '  vec3 fade_xyz = fade(Pf0);',
    '  vec4 n_z = mix(vec4(n000,n100,n010,n110),vec4(n001,n101,n011,n111),fade_xyz.z);',
    '  vec2 n_yz = mix(n_z.xy,n_z.zw,fade_xyz.y);',
    '  float n_xyz = mix(n_yz.x,n_yz.y,fade_xyz.x);',
    '  return 2.2 * n_xyz;',
    '}'
  ].join('\n');

  /* --- the material, built on three's own physical shader ---------------- */
  function makeBeamMaterial(speedSign) {
    var physical = THREE.ShaderLib.physical;
    var uniforms = THREE.UniformsUtils.clone(physical.uniforms);

    uniforms.diffuse.value = new THREE.Color(CFG.beamColor);
    uniforms.roughness.value = 0.3;
    uniforms.metalness.value = 0.3;
    uniforms.envMapIntensity.value = 10;
    uniforms.time = { value: 0 };
    uniforms.uSpeed = { value: CFG.speed * speedSign };
    uniforms.uNoiseIntensity = { value: CFG.noiseIntensity };
    uniforms.uScale = { value: CFG.scale };

    var header = [
      'varying vec3 vEye;', 'varying float vNoise;', 'varying vec2 vUv;', 'varying vec3 vPosition;',
      'uniform float time;', 'uniform float uSpeed;', 'uniform float uNoiseIntensity;', 'uniform float uScale;',
      NOISE
    ].join('\n');

    var vertexHeader = [
      'float getPos(vec3 pos) {',
      '  vec3 noisePos = vec3(pos.x * 0., pos.y - uv.y, pos.z + time * uSpeed * 3.) * uScale;',
      '  return cnoise(noisePos);',
      '}',
      'vec3 getCurrentPos(vec3 pos) { vec3 newpos = pos; newpos.z += getPos(pos); return newpos; }',
      'vec3 getNormal(vec3 pos) {',
      '  vec3 curpos = getCurrentPos(pos);',
      '  vec3 nextposX = getCurrentPos(pos + vec3(0.01, 0.0, 0.0));',
      '  vec3 nextposZ = getCurrentPos(pos + vec3(0.0, -0.01, 0.0));',
      '  vec3 tangentX = normalize(nextposX - curpos);',
      '  vec3 tangentZ = normalize(nextposZ - curpos);',
      '  return normalize(cross(tangentZ, tangentX));',
      '}'
    ].join('\n');

    var vert = header + '\n' + vertexHeader + '\n' + physical.vertexShader;
    vert = vert.replace('#include <begin_vertex>',
      '#include <begin_vertex>\ntransformed.z += getPos(transformed.xyz);');
    vert = vert.replace('#include <beginnormal_vertex>',
      '#include <beginnormal_vertex>\nobjectNormal = getNormal(position.xyz);');

    var frag = header + '\n' + physical.fragmentShader;
    frag = frag.replace('#include <dithering_fragment>',
      '#include <dithering_fragment>\n' +
      'float randomNoise = noise(gl_FragCoord.xy);\n' +
      'gl_FragColor.rgb -= randomNoise / 15. * uNoiseIntensity;');

    return new THREE.ShaderMaterial({
      defines: Object.assign({}, physical.defines),
      uniforms: uniforms,
      vertexShader: vert,
      fragmentShader: frag,
      lights: true,
      fog: false
    });
  }

  /* --- n planes standing side by side, as one buffer --------------------- */
  function stackedPlanes(n, width, height, segments) {
    var geometry = new THREE.BufferGeometry();
    var numVertices = n * (segments + 1) * 2;
    var positions = new Float32Array(numVertices * 3);
    var uvs = new Float32Array(numVertices * 2);
    var indices = new Uint32Array(n * segments * 6);

    var vo = 0, io = 0, uo = 0;
    var totalWidth = n * width;
    var xBase = -totalWidth / 2;

    for (var i = 0; i < n; i++) {
      var x = xBase + i * width;
      /* each beam samples the noise field somewhere else, so neighbours never
         ripple in lockstep */
      var uvX = Math.random() * 300;
      var uvY = Math.random() * 300;
      for (var j = 0; j <= segments; j++) {
        var y = height * (j / segments - 0.5);
        positions.set([x, y, 0, x + width, y, 0], vo * 3);
        var v = j / segments;
        uvs.set([uvX, v + uvY, uvX + 1, v + uvY], uo);
        if (j < segments) {
          indices.set([vo, vo + 1, vo + 2, vo + 2, vo + 1, vo + 3], io);
          io += 6;
        }
        vo += 2;
        uo += 4;
      }
    }
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
    geometry.setIndex(new THREE.BufferAttribute(indices, 1));
    geometry.computeVertexNormals();
    return geometry;
  }

  /* --- scene ------------------------------------------------------------- */
  var canvas = host.querySelector('canvas');
  var renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: false, alpha: true, powerPreference: 'low-power' });
  renderer.setPixelRatio(CFG.dpr);
  renderer.setClearColor(0x000000, 0);

  var scene = new THREE.Scene();
  var camera = new THREE.PerspectiveCamera(30, 1, 0.1, 200);
  camera.position.set(0, 0, 20);

  var rad = function (d) { return d * Math.PI / 180; };
  var fields = [];

  /* One field, exactly as the original: the beams sit shoulder to shoulder and
     the noise is what makes some of them rise toward the camera. Two crossing
     fields read as clutter at this size. */
  (function () {
    var group = new THREE.Group();
    group.rotation.z = rad(CFG.tilt);
    var mat = makeBeamMaterial(1);
    group.add(new THREE.Mesh(stackedPlanes(CFG.beams, CFG.beamWidth, CFG.beamLength, CFG.segments), mat));
    var light = new THREE.DirectionalLight(new THREE.Color(CFG.light), CFG.intensity);
    light.position.set(0, 3, 10);
    group.add(light);
    scene.add(group);
    fields.push({ group: group, mat: mat, baseTilt: CFG.tilt, sign: 1 });
  })();

  scene.add(new THREE.AmbientLight(0xffffff, 1));

  function resize() {
    var w = host.clientWidth, h = host.clientHeight;
    if (!w || !h) return;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h, false);
  }
  resize();
  window.addEventListener('resize', resize);

  /* --- loop -------------------------------------------------------------- */
  /* Runs only while the layer is on screen and the tab is in front. Nothing
     about this scene needs to keep ticking when nobody is looking at it. */
  var clock = new THREE.Clock();
  var running = false, raf = 0, last = 0;
  var step = 1000 / CFG.fps;

  function frame(now) {
    if (!running) return;
    raf = requestAnimationFrame(frame);
    if (now - last < step) return;          // hold to CFG.fps, do not redraw every vsync
    last = now;
    var d = clock.getDelta();
    for (var i = 0; i < fields.length; i++) {
      fields[i].mat.uniforms.time.value += 0.1 * d;
    }
    renderer.render(scene, camera);
  }
  function start() { if (running) return; running = true; clock.getDelta(); last = 0; raf = requestAnimationFrame(frame); }
  function stop() { running = false; cancelAnimationFrame(raf); }

  document.addEventListener('visibilitychange', function () {
    if (document.hidden) stop(); else if (wanted) start();
  });

  /* The host is position:fixed, so an IntersectionObserver on it would always
     report visible and never stop anything. What actually matters is whether
     the layer is faded in: over the hero it is at opacity 0 and there is no
     reason to be drawing it at all. main.js drives this through setVisible. */
  var wanted = false;

  /* the page can nudge the tilt as it scrolls, so the bands are not identical
     from top to bottom */
  window.KomnataBeams = {
    setDrift: function (t) {                   // t is 0 at the top, 1 at the bottom
      for (var i = 0; i < fields.length; i++) {
        fields[i].group.rotation.z = rad(fields[i].baseTilt + fields[i].sign * t * 7);
      }
    },
    setVisible: function (on) {
      wanted = on;
      if (on && !document.hidden) start(); else stop();
    },
    start: start,
    stop: stop,
    isRunning: function () { return running; }
  };
})();
