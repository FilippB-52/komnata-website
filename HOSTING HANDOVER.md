# KØMNATA website: hosting handover

Everything needed to put this site on the KØMNATA domain, or to move it off
Horizon Symmetry's hosting entirely.

Written 21 September 2026.

---

## What this site actually is

Plain HTML, CSS, JavaScript and images. **No build step, no server, no
database, no API keys.** The whole thing is 16.4 MB of files in the `site/`
folder, and a browser can open them directly.

That matters for this handover: it will run on any static host, free ones
included, and moving it is copying a folder. Nothing is locked to Vercel.

The one thing it needs from a host: **byte range requests (HTTP 206)**. The
hero video will not play in Safari without them. Every real host does this;
`python -m http.server` does not, so do not test with that.

Where it lives now:

| | |
|---|---|
| Live at | https://komnata-website.vercel.app |
| Code | `github.com/FilippB-52/komnata-website` |
| Host | Vercel, project `komnata-website`, under the **Hosy** team |
| Deploys | automatically, on every push to `main` |
| Domain | none attached yet, the domain is at Namecheap and still points elsewhere |

---

## Three ways to go

**Route A. Leave it where it is and just point the domain.** Half an hour,
nothing moves, and the hosting costs you nothing where it is. Best if the
night is close.

**Route B. KØMNATA takes over the hosting, Horizon Symmetry keeps the code.**
The project moves to a KØMNATA Vercel account. They control the domain, the
deploys and the analytics. This is the one to pick if KØMNATA wants to own it
properly. An hour or so.

**Route C. Move it off Vercel completely.** Netlify, Cloudflare Pages, GitHub
Pages, or ordinary shared hosting over FTP. Works because there is no build
step. Only worth doing if they already pay for hosting somewhere.

**Recommended: A now, B after the party.** Getting the domain live is the
urgent part. Moving accounts is not, and doing both at once on the week of an
event is how a site goes down on the night.

---

## Route A: point the Namecheap domain at the current site

Do it in this order. Adding the domain in Vercel **first** is what makes the
rest exact.

### 1. Add the domain in Vercel

1. vercel.com → team **Hosy** → project **komnata-website**
2. Settings → Domains
3. Type the domain (for example `komnata.club` and `www.komnata.club`) → Add

Vercel then shows **the exact DNS records to create**. Use those.

> Do not copy an IP address out of a blog post or out of this document. Vercel's
> targets are not fixed: checked while writing this, their CNAME target resolved
> to two addresses, neither of which was the one usually quoted in guides. The
> panel shows what is correct today for this project.

### 2. Put those records into Namecheap

1. namecheap.com → sign in → Domain List → **Manage** next to the domain
2. **Advanced DNS** tab
3. Delete any existing `A` or `CNAME` record for `@` and for `www`, including
   Namecheap's default "parking page" record
4. Add what Vercel showed you, normally:
   - an **A Record**, host `@`, value = the IP Vercel gave
   - a **CNAME Record**, host `www`, value = the target Vercel gave
5. TTL: Automatic
6. Save

### 3. Wait, then check

DNS usually takes 10 to 60 minutes, occasionally longer. Vercel's Domains page
shows a tick when it sees the records, and issues the HTTPS certificate on its
own. Nothing to do for SSL.

Working means: the domain opens the site, and `https://` shows a padlock.

---

## Route B: move it to a KØMNATA account

1. **KØMNATA makes a Vercel account** at vercel.com. The Hobby plan is free and
   enough: this site is static and has no server functions.
2. **KØMNATA makes a GitHub account** and Filipp transfers the repository to
   them (GitHub → repo → Settings → Transfer ownership), or they fork it.
3. In their Vercel: **Add New → Project → import the repository.**
4. In the import screen set **Output Directory to `site`**. Everything else is
   already in `vercel.json` in the repo. Leave the build command empty.
5. Deploy, check the `.vercel.app` address works.
6. Then do Route A's DNS steps against **their** project, and remove the domain
   from the Horizon Symmetry one so the two do not fight over it.

---

## What Filipp needs to hand over

| Item | Where it is | Needed for |
|---|---|---|
| The repository | `github.com/FilippB-52/komnata-website` | everything |
| Namecheap login | KØMNATA already has this | the DNS records |
| Meta Pixel ID `2480966919077348` | already in the code | so their ads team can claim it in Meta Business Manager |
| The Patt event link | already in the code | the ticket button |
| Spotify playlist links | already in the code | the record player |
| Telegram `@itskomnataa`, Instagram `@itskomnata` | already in the code | the channel cards |
| The source artwork | `Source files/` in the repo | re-exporting headings or photos later |

Everything except the Namecheap login is already inside the repository. **Hand
over the repo and they have the site.**

Not handed over, and not needed: there are no API keys, no environment
variables, no database and no admin login. Nothing to rotate and nothing that
can be left behind.

---

## Things that will break it

**Do not serve the repository root.** Only `site/` is the website. The folders
beside it hold source artwork, previous versions and the original footage.
`vercel.json` already pins this; any other host has to be told.

**Do not test with `python -m http.server`.** It answers range requests with
200 instead of 206, so Safari refuses to play the hero video and the site looks
broken for no reason. Use `npx serve -l 5180 site`.

**After editing CSS or JS, bump the `?v=` number** on that file's tag in
`site/index.html`. Those files are cached for a year on purpose. Without the
bump, visitors keep the old one and swear nothing changed.

**Two Google map embeds would double the page weight.** There must only ever be
one element carrying `data-map`. The Google embed is 1.9 MB of script.

**Keep `data-buy` on the ticket buttons.** That attribute is what fires the
Meta Pixel's InitiateCheckout event. Remove it and every sale that starts on
the site silently stops being counted.

---

## If something goes wrong

- **Domain shows a Namecheap parking page:** their default record is still
  there. Delete every `A` and `CNAME` on `@` and `www`, then re-add Vercel's.
- **"Invalid Configuration" in Vercel:** the records do not match. Compare them
  character by character with what the Domains page is asking for.
- **Site loads but the video does not play:** the host is not answering range
  requests with 206.
- **A change was deployed but nobody sees it:** the `?v=` was not bumped.
- **Rolling something back:** `Background versions/` and `Rollback points/` in
  the repo each hold a previous state with its own restore instructions, and
  the full history is in git.
