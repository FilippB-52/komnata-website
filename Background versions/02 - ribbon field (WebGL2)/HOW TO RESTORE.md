# Background version 02: ribbon field

The drifting cyan ribbon field, live 21 Sep 2026. Raw WebGL2, no dependencies,
ported from the Originkit RibbonGlow reference Filipp supplied.

Replaced because Stas wanted the grainy folded-ribbon look instead. This is the
rollback copy.

## What it looked like

Soft cyan ribbons accumulated over 36 layers, drifting and slowly turning,
reacting gently to the cursor. Brand cyans `#8DEEED` and `#256F6E` over
`#0B0C0D`, shader gain 0.42, saturation 3.0, layer opacity 0.52.

## To put it back

1. Copy `backdrop.js` over `site/components/backdrop/backdrop.js`.
2. Bump the cache version on its script tag in `site/index.html`.
3. In `site/js/main.js` set the backdrop fade back to `opacity: .52`.

Nothing else changes: the markup (`<div class="backdrop" data-backdrop>`), the
CSS, the visibility triggers and the public API are shared by both versions.

## Numbers worth keeping

- gain and saturation trade against each other, because the tonemap desaturates
  as it is driven harder: gain .62/sat 1.55 gave 9% saturated highlights,
  gain .40/sat 3.2 gave 31%. Take colour from the shader at a modest gain and
  presence from the layer opacity.
- Cost was tuned from 72.6M to 5.18M field iterations per frame (36 layers,
  scale 3, dpr 1). At 56 layers/scale 2/dpr 2 a 1440x900 desktop ran at a
  166ms median frame, about 6fps.
