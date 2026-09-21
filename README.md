# KØMNATA

Site for the KØMNATA party brand, Madrid. Built for the 27 Frames night on
Friday 25 September 2026 at Frecuencia, Calle de Lagasca 103.

**Live:** https://komnata-website.vercel.app

## Where things are

| Path | What it is |
|---|---|
| `site/` | The whole website. This is the only folder that gets served. |
| `site/index.html` | One page, all sections. |
| `site/css/style.css` | All styling. Cache-busted with `?v=` in the HTML, bump it when you edit. |
| `site/js/main.js` | Scroll, reveals, the lazy map and Instagram embeds. |
| `site/components/` | Two self-contained pieces: the vinyl player and the Three.js beams. |
| `site/assets/` | Video, images, fonts. Served with a year of immutable cache. |
| `Fonts/`, `Template Shared by the Client/`, `Dropzone_/` | Source material. Never served. |
| `Videos & Images/` | 236 MB of original footage. Local only, not in the repo. |

## Running it locally

No build step. Serve `site/` with anything that supports byte ranges, or
Safari will refuse to play the hero video:

```
npx serve -l 5180 site
```

Do not use `python -m http.server`: it answers `Range:` requests with 200
instead of 206 and the video stays black.

## Deploying

Pushing to `main` deploys to production automatically. `vercel.json` pins the
web root to `site/`, so nothing above it is ever public.

## Two things to know before editing

**The hero video has two cuts.** Desktop gets `hero-v6.mp4` (1920x1080,
3.9 MB), phones get `hero-v6-mobile.mp4` (960x540, 1.1 MB). The choice happens
in an inline script in `index.html` that sets `src` before the element has one,
so the big file is never requested on a phone. If you put the `src` back on the
`<video>` tag, every phone downloads 3.9 MB again.

**The Telegram card is a placeholder on purpose.** Telegram's post widget
returns an empty stub because the channel has content protection switched on.
The channel admin turns that off under Manage channel, and the replacement
embed is already written into the comment next to the card.
