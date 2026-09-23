# KØMNATA website

Client site for the KØMNATA party brand in Madrid. Vanilla HTML/CSS/JS, no
build step. Live at https://itskomnata.com (and on
https://komnata-website.vercel.app), deployed from
`main` on push. Repo `FilippB-52/komnata-website`.

Only `site/` is served. `vercel.json` pins the web root there, so everything
beside it (source artwork, references, the footage) stays private.

## Traps specific to this repo

**The five section headings are artwork, not type.** If they are ever
re-exported, all five must be scaled by ONE shared factor. Sizing them
independently puts a line of capitals at a different pixel height in each file,
and then one CSS height renders the headings at visibly different letter sizes.
This already went wrong once: 105px in one file against 176px in another.

**The backdrop layer opacity is a legibility limit, not taste.** It is .14 in
`main.js`. The layer peaks at `#C9CECD`, so over the page ground: .14 leaves
body copy at 4.63:1, .18 at 4.16:1, .26 at 3.33:1. Above .14 text sitting
directly on the ribbon starts to disappear.

**The backdrop's field texture stores a SCALAR, not colour.** The ribbon edge
is cut from it at full resolution in the finish pass. That is deliberate: a
smooth gradient magnifies cleanly by any factor, but the hard edge of a
smoothstep facets badly, and interpolating the edge is what made an earlier
build look like it was rendered at 144px. So `scale` now controls how much
detail the form has, never how crisp its edge is. The target is half float for
the same reason: at 8 bits the core's 0.055 width is about 14 levels and the
edge bands.

**Measure the backdrop on a real GPU.** Headless Chromium defaults to
SwiftShader, which rasterises on the CPU and wildly over-penalises both
`backdrop-filter` and heavy fragment shaders. It reported a 2.5x desktop
regression that did not exist. Launch with `--use-gl=angle --use-angle=metal`.

**Never select the backdrop's float target on the extension alone.**
`EXT_color_buffer_float` promises RGBA16F is RENDERABLE, never FILTERABLE, and
several drivers hand back a valid target and then sample it NEAREST. The ribbon
edge is cut from that texture at full resolution, so without interpolation the
edge snaps to the field texel grid: a hard 5px staircase at `scale:5` on a dpr-1
screen. That is what the background looked like on Stas's machine on 22 Sep
while it was smooth on every machine here. `backdrop.js` now uploads a two-texel
ramp, samples the midpoint and reads it back before trusting the format. **8-bit
AND linear reads smooth; float AND nearest does not.**

**IE's campus wifi blocks itskomnata.com as "high-risk"** and decrypts HTTPS to
do it, so on campus the certificate is issued by `Instituto de Empresa SL
Forward Trust CA`, not Let's Encrypt. `komnata-website.vercel.app` is not
intercepted, which makes a useful control. **Do not debug this as a site fault.**
Prove the site from outside their network, and the fix is a recategorisation
request at `urlfiltering.paloaltonetworks.com`, not anything in this repo.

**The Meta Pixel transmits NOTHING when `navigator.webdriver` is true.** Not one
event, not even PageView, on a perfectly correct install. Any Playwright test of
the pixel must spoof that flag or it will report zero and look like a bug.

**`.ticket__side` is what controls the mobile card's margins.** It is declared
three times and only the `max-width:760px` one applies on a phone. It held
`padding:0`, which put every block on the card's own edge and, because `.ticket`
has `overflow:hidden` and a 24px radius, clipped the tab pills at both ends.
It is now 18px, matching `.ticket__foot`, so everything shares one vertical line.

**Every Next Night pane shares one grid cell**, so the tallest sets the card's
height. On a phone that is Music, which means the record's `--v-size` is the
knob that shortens the whole card, not anything in Summary.

**The Google Maps button must use the Maps URL API,** not a copied share link.
A share URL was in there and resolved to nothing: empty search bar, blank card,
no pin, because its ftid was 15 hex digits where Google's are 16. There is a
note beside it in the markup.

**The map iframe is cropped 48px off the top** to hide Google's dead "Open in
Maps" chip, and the pin is moved up by half the crop to compensate. Crop only
the top: the Google logo and attribution along the bottom are required by the
embed terms.

**Telegram has no live feed on purpose.** The profile-style preview
(`t.me/s/<channel>`) sends `X-Frame-Options: SAMEORIGIN` so it cannot be
framed at all, and the channel itself is dormant: 8 posts, newest 15 Nov 2025,
38 subscribers, against Instagram's 535 followers. A posts widget would
advertise that directly under copy promising drops land there first.

**Never test the hero video with `python -m http.server`.** It answers `Range:`
with 200 instead of 206 and Safari refuses to play. Use `npx serve -l 5180 site`.

**Desktop and phone get different hero videos.** `hero-v6.mp4` is 3.9 MB,
`hero-v6-mobile.mp4` is 1.1 MB, chosen by an inline script before the element
has a `src`. Putting the `src` back on the `<video>` tag makes every phone
download 3.9 MB again.

## Where things are

| Path | What |
|---|---|
| `site/` | The website. The only folder served. |
| `site/components/backdrop/` | The animated background. All knobs are in `CFG`. |
| `site/components/vinyl-player/` | The record player. Has its own README. |
| `Background versions/` | Previous backgrounds, each with restore instructions. |
| `Source files/` | Originals: artwork, brand marks, references. See its INDEX.md. |
| `Dropzone_/` | Filipp drops files here. Say "ingest the dropzone" and they get filed into `Source files/`. Should normally be empty. |
| `Videos & Images/` | 236 MB of original footage. Local only, gitignored. |
| `KOMNATA - Hosting Handover.pdf` | The client-facing hosting doc. Source is `HOSTING HANDOVER.md`, rendered by the script in the session scratchpad. Edit the .md, re-render, keep both in step. |

## Conventions

- Cache-bust by bumping `?v=` on the CSS/JS in `index.html` after any edit.
- The Meta Pixel is the only tracker. Base code in `<head>`, `InitiateCheckout`
  on the Patt button from `main.js`.
- Prices, client names and anything outward-facing: check it before it ships.
