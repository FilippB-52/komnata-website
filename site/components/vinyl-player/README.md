# Vinyl player

The record for the "Our playlists" section. A turntable seen from straight above:
the platter turns on its own, the tonearm creeps inward as it plays, music symbols
drift off the stylus. Hold the record with the mouse and it stops and turns with
your hand; let go and it picks the speed back up.

Two files, no dependencies, no build step.

```
vinyl-player.css
vinyl-player.js
```

## Putting one on a page

```html
<link rel="stylesheet" href="components/vinyl-player/vinyl-player.css">

<div data-vinyl
     data-cover="assets/img/playlists/main-room.jpg"
     data-title="The main room"
     data-turn="9"></div>

<script src="components/vinyl-player/vinyl-player.js"></script>
```

That is the whole integration. The script finds every `[data-vinyl]` on the page
and builds the rest itself.

## The knobs

| Attribute | What it does |
|---|---|
| `data-cover` | The image that goes in the middle of the record, where a real label sits. Use the playlist's cover art. Square crops best, anything else gets centre-cropped to a circle. |
| `data-title` | The playlist name. It is not drawn on screen, it goes into the label a screen reader announces. |
| `data-turn` | Seconds for one full revolution. Default 9. A real LP is 1.8, which is far too fast to look at. |
| `data-notes` | `off` removes the music symbols. |

Three CSS variables, set on the element or in your own stylesheet:

```html
<div data-vinyl style="--v-size:min(620px,80vmin);--v-label:30%;--v-art:50% 34%"></div>
```

| Variable | Default | What it does |
|---|---|---|
| `--v-size` | `min(560px,82vw)` | How big the whole thing is. Everything inside scales off this one number, so there is nothing else to adjust between a 240px thumbnail and a 900px hero. |
| `--v-label` | `33.5%` | How big the cover in the middle is. 33.5% is a real 4in label on a 12in record. 30% to 26% reads as a picture disc and is better for a busy cover. The run-out groove follows it automatically. |
| `--v-art` | `50% 50%` | Which part of a non-square cover survives the circular crop, same syntax as `object-position`. A portrait poster usually wants something nearer `50% 34%` than dead centre. |

### Using your own label art instead of `data-cover`

Anything you nest inside the div is used as the label and `data-cover` is ignored.
An `<img>`, an `<svg>`, a `<picture>`, all fine:

```html
<div data-vinyl>
  <img src="assets/img/playlists/slavic-side.jpg" alt="">
</div>
```

With no cover and nothing nested you get the house label: a bone record label with
KØMNATA · MADRID curved around the top and the Ø in the middle. It is drawn inline,
so it picks up the page's real fonts and brand colours.

### From JavaScript

```js
var v = document.querySelector('[data-vinyl]').__vinyl;
v.stop();                       // let it coast to a halt
v.start();                      // back up to speed
v.setCover('assets/img/….jpg'); // swap the label, e.g. when a tab changes
```

`KomnataVinyl.init(el)` and `KomnataVinyl.initAll(scope)` are there for anything
you add to the page after load.

## Three or more on one page

Give each its own cover and title and put them in a grid. Each runs its own loop
and each loop stops when the element scrolls out of view, so a row of three costs
about what one costs.

## Things worth knowing before you change it

- **Only put something in `.vinyl__spin` if it actually looks different at a
  different angle.** The grooves and the track lands are perfectly rotationally
  symmetric, so they sit outside it and are painted once. Move them back in and
  they get re-rasterised at a new sub-pixel offset whenever anything forces a
  repaint; a 3.4px ring pattern re-sampled at a new angle beats against the pixel
  grid and the record visibly flashes. Measured: rings inside the rotating layer
  changed 2,698 pixels between two angles, rings outside it changed 0.
- **No `mix-blend-mode` inside `.vinyl__spin`,** and no `will-change` on the note
  spans. Both create compositing layers that churn and force exactly that repaint.
- **The light never moves.** The label rotates; the gloss layer
  (`.vinyl__gloss`) and the edge light (`.vinyl__edge`) stay put. Move them inside
  `.vinyl__spin` and the record stops reading as vinyl and starts reading as a
  spinning drawing.
- **Every radial-gradient that sets a radius says `closest-side`.** Without it,
  100% means the corner of the box, not the edge of the circle, and every ring
  lands about 41% further out than the number says.
- **The geometry lives in two places and has to match.** The radii are at the top
  of the CSS; the tonearm pivot, length and travel are the constants at the top of
  the JS. Move the platter without moving the pivot and the stylus floats off the
  record.
- The default is 9 seconds a turn, not a real 33 rpm. On a page, realistic speed
  reads as frantic.
- Reduced motion turns off the spin and the symbols. The drag still works.

## Getting a cover off Spotify

No API key needed. Spotify's oEmbed endpoint gives you the playlist title and a
300px thumbnail:

```bash
curl -s "https://open.spotify.com/oembed?url=https://open.spotify.com/playlist/<ID>"
```

The `thumbnail_url` it returns ends in an image hash prefixed `ab67706c0000d72c`.
Swap that prefix for **`ab67706c0000bebb`** on the same hash and you get the
largest version Spotify serves (640px on the long edge):

```
https://image-cdn-fa.spotifycdn.com/image/ab67706c0000bebb<hash>
```

Save it into `assets/img/playlists/` rather than hotlinking. The CDN URL changes
whenever the playlist art is changed, and a dead label is worse than a stale one.

Covers on file:

| File | Playlist | Source |
|---|---|---|
| `rus-komnata.jpg` | рус комната 7.000.000+ | `open.spotify.com/playlist/5jDcL7P0EZ90OxR35QT4km`, 467x640, pulled 20 Sep 2026 |

## Seeing it

`site/vinyl-showcase.html` is the component alone on black, nothing else on the
page. Serve the `site/` folder and open `/vinyl-showcase.html`.
