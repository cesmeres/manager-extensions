# Esmeres Extensions — storage, build & distribution

How we store, version, and ship Manager.io extensions as a product.

## The one fact that drives everything
In Manager.io a client installs an extension by **pasting a URL** (Settings →
Extensions). Manager loads that URL live, in an iframe, every time. So the
**hosted URL is the product** — and updating what's behind that URL updates
every client instantly, on their *live books*. Treat these three things as
separate:

| Concern | Where it lives | Rule |
|---|---|---|
| **Source of truth** | git monorepo (`extensions/*/src`) | reviewed, tested, tagged |
| **Build artifact** | `dist/<name>/<version>/` | immutable once shipped |
| **Distribution URL** | `ext.esmeres.com/<name>/stable/` | a *moving pointer* you promote |

## Source of truth — one monorepo
A single git repo for the whole suite, so shared code, design, and CI stay
consistent:

```
esmeres-extensions/
├── ARCHITECTURE.md          ← this file
├── catalog.json             ← registry: every extension + current stable version
├── .gitignore               ← client data (*.xlsx/*.csv) never committed
├── lib/                     ← shared, reused across all extensions
│   ├── bridge.js            ← Manager postMessage API client (origin-pinned)
│   ├── format.js            ← money/date (PHP ₱, etc.)
│   ├── csv.js               ← export
│   └── ui.css               ← design tokens / shared look
├── extensions/
│   └── retainer-collections/
│       ├── manifest.json    ← name, version, target page, permissions, min Manager ver
│       ├── src/{index.html, engine.js}
│       ├── test/run.js      ← pure-logic regression test
│       └── CHANGELOG.md
└── dist/                    ← build output (git-ignored; hosted)
```

Extract anything used twice into `lib/` (the bridge, formatting, CSV export, the
design tokens). One extension = one folder with its own `manifest.json`,
`CHANGELOG.md`, and tests. `catalog.json` is your internal "app store" index.

Per-repo vs monorepo: **monorepo** while the suite shares a design system and a
bridge library. Split a extension out only if it gets its own release cadence or
external contributors.

## Build — ship a single immutable file per version
Keep extensions dependency-free (they already are). A tiny build step inlines
`lib/*` + `engine.js` into one `index.html` so the hosted artifact has **no
relative-path or load-order fragility inside the iframe**, then writes it to an
immutable, versioned path:

```
dist/retainer-collections/1.0.0/index.html      ← never changes again
dist/retainer-collections/1.1.0/index.html
```

Version with **semver**, tag the git commit (`retainer-collections/v1.1.0`), and
keep `CHANGELOG.md` per extension.

## Distribution — versioned hosting + moving channels
Host `dist/` on a static host (Cloudflare Pages / GitHub Pages / Netlify) behind
**your own domain** — `ext.esmeres.com` — via CNAME. Owning the domain means you
can change hosts without every client re-pasting a URL.

Publish immutable versions **and** moving channel pointers:

```
https://ext.esmeres.com/retainer-collections/1.1.0/     ← immutable (pin here for a client who must not move)
https://ext.esmeres.com/retainer-collections/beta/      ← you test here first
https://ext.esmeres.com/retainer-collections/stable/    ← what clients install; promote a validated version into it
```

Release flow: build → run tests + an iframe smoke test → publish `x.y.z/` →
verify on `beta/` against a real Manager business → **promote** by pointing
`stable/` at it (copy or redirect). Rollback = repoint `stable/` at the previous
version. Never edit a shipped `x.y.z/`.

## Per-client differences without forking code
Every client runs a **separate Manager business**; the *same* artifact reads
whichever business it's embedded in via the bridge. Never fork code per client.
Vary behaviour by **config**, in this order of preference:

1. **Derive from the business** through the bridge (firm name, base currency).
2. **Install-URL query params** for the rest:
   `…/stable/?account=Retainer&currency=PHP` → read with `URLSearchParams`.
   (Avoid `localStorage` for per-business config — it's shared across every
   business a user opens in that Manager app and will collide.)

## Security & data hygiene (this is a selling point)
These handle live financial data, so bake it in and say so in marketing:
- **Strict CSP, zero outbound network** (`connect-src 'none'`) — data never
  leaves the Manager tab. No CDNs, no fonts-from-web, no analytics.
- **Origin-pinned** postMessage; **read-only** (GET) unless a feature truly needs
  writes, then gate it.
- **No client data in git** — enforced by `.gitignore`. Test fixtures must be
  anonymised.

## Licensing reality
A pure client-side static page can't strongly enforce license keys — CSP blocks
phone-home, and anyone with the URL can read the HTML. So sell it as a **hosted +
supported service** (you host, you maintain, you version), not as copy-protected
code. Add a `LICENSE`, minify the `dist/` build, and keep `src/` private if the
repo is the moat.
