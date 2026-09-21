# Rollback point 01

State of the page before Next Night got tabs, 21 Sep 2026.

Until this change the page had **six** sections: hero, Next Night, Gallery,
Social, Music, Find Us. Next Night's left frame was a single block of copy with
a table under it, and Find Us was a section of its own with the map in it.

The client asked for Next Night to carry more, so its left frame became three
tabs (Summary, Music, Map) and the Find Us section was folded into the Map tab
and removed from the page.

## What is in here

| File | What it is |
|---|---|
| `find-us-section.html` | The whole Find Us `<section>`, exactly as it was. |
| `next-night-left-frame.html` | Next Night's left frame, the `div.ticket__side`, exactly as it was. |

## To put it back

1. In `site/index.html`, replace the current `div.ticket__side` (the one holding
   `nav.tabs` and the `div.tab__pane` blocks) with the contents of
   `next-night-left-frame.html`.
2. Paste `find-us-section.html` back in after the Music section, before the
   bookings line.
3. Put `Map` back in the nav, after `Music`:
   `<a href="#map" data-nav="map">Map</a>`
4. In `site/css/style.css`, the tab rules are under `--- NEXT NIGHT TABS ---`
   and can be deleted.
5. In `site/js/main.js`, the tab handler is under `--- TABS ---` and can be
   deleted.
6. Bump the `?v=` on the CSS and JS in `index.html`.

Nothing was deleted from the repo, so `git log` has all of it too.

## Watch out for

- The map iframe is lazy loaded by `[data-map]` in `main.js`, and there must
  only ever be ONE `[data-map]` on the page. If Find Us comes back, the copy
  inside the Map tab has to go, or two 1.9 MB Google embeds will load.
- The map iframe is cropped 48px off the top to hide Google's dead "Open in
  Maps" chip, and the pin is offset by half that to compensate. Both numbers
  live on `.venue__map` as `--map-top-crop`.
