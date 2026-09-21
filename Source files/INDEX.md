# Source files

Everything Filipp drops into `Dropzone_/` gets filed in here. Originals only:
nothing in this folder is served by the website. The web-ready versions live
under `site/assets/`.

## Brand marks

| File | What it is |
|---|---|
| `komnata-mark.png` | The Ø mark, 2000x2001 with transparency. Source for the favicons and the Telegram card's picture. |

## Section headlines

The five section titles drawn in the brand lettering, each a 2000x2000 canvas
with the ink covering only 4 to 17% of it.

| File | Where it appears |
|---|---|
| `next-night.png` | Next night |
| `nights-we-already-had.png` | Gallery |
| `our-channels.png` | Social |
| `what-we-play.png` | Music |
| `find-us.png` | Map |

**If these are ever re-exported, all five must be scaled by the SAME factor.**
Sizing them independently puts a line of capitals at a different pixel height
in each file, and then one CSS height renders the five headings at visibly
different letter sizes. The web versions in `site/assets/img/headings/` are
cropped to their ink and share one scale, so a line of capitals measures 115
to 118px in every one.

## Gallery photos

The originals behind `site/assets/img/nights/12.webp` through `18.webp`, named
by what they show so the running order can keep the same locations apart.

The web versions are square, 900x900, black and white, and tone-matched to the
eleven that were already there. That matching is not optional: straight off the
camera these sit at a median of 6 to 14 against the existing set's 58, so
converted as-is they drop in as near-black tiles. Each is autocontrasted then
gamma-corrected to a median of 58.

## Design references

| File | What it is |
|---|---|
| `background - smoke ribbon (current).jpg` | Stas's reference for the background that is live now. |
| `background - teal gradient (earlier).jpg` | An earlier direction, before the smoke reference. |
| `vinyl player UI.jpg` | Reference for the record player component. |
| `dark site layout.jpg` | A dark site layout, general direction. |

## Related

- Previous website backgrounds, with instructions to roll back to them, are in
  `Background versions/` at the project root.
- The original footage the hero video was cut from is in `Videos & Images/`,
  which is local only and deliberately kept out of the repository (236 MB).
