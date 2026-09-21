# Background version 01: beams

The tilted cyan ribbons that were the site background until 21 Sep 2026.
Three.js, 10 beams displaced by 3D Perlin noise, drawn at 30fps and dpr 1.

Kept because the client did not like it and asked for something else. This is
the rollback copy.

## What it looked like

Soft horizontal bands drifting slowly, brand cyan `#8DEEED` at 37% layer
opacity over `#0B0C0D`. Faded in across the Our channels section and stayed
for the rest of the page.

## To put it back

1. Copy `beams.js` back to `site/components/beams/beams.js`.
2. In `site/index.html`, inside `<body>`, restore the layer markup:

   ```html
   <div class="beams" data-beams aria-hidden="true">
     <canvas></canvas>
     <span class="beams__fade"></span>
   </div>
   ```

3. In `site/index.html`, restore the two script tags before `js/main.js`:

   ```html
   <script src="https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.min.js" defer></script>
   <script src="components/beams/beams.js?v=6" defer></script>
   ```

   Three.js is needed ONLY by this file. Nothing else on the site uses it.

4. In `site/js/main.js`, the fade block looks for `[data-beams]` and calls
   `window.KomnataBeams.setVisible()` and `.setDrift()`. Point it back at
   those instead of whatever replaced them.

5. In `site/css/style.css`, restore `.beams` and `.beams__fade`.

Every one of these is in git history too: the last commit with this version
live is the one before the background was replaced. `git log -- site/components/beams/beams.js`
