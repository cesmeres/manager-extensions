# Esmeres Extensions

A suite of Manager.io extensions, built and shipped as a product.

- **[ARCHITECTURE.md](ARCHITECTURE.md)** — how we store, version, and distribute.
- **[catalog.json](catalog.json)** — registry of extensions + current stable versions.

## Layout
```
extensions/<name>/            one extension
  manifest.json               name, version, target page, permissions, config, channels
  src/{index.html, *.js}      source (dependency-free)
  test/run.js                 pure-logic regression test
  CHANGELOG.md
build/build.mjs               inlines src into a single-file dist artifact
dist/<name>/<version>/        immutable build output (hosted; git-ignored)
```

## Develop
Open `extensions/<name>/src/index.html` in a browser and use the extension's
offline/import mode. Live (Manager) mode only works when installed inside Manager.

## Test
```bash
node extensions/retainer-collections/test/run.js "/path/to/detail.csv"
```

## Build & release
```bash
node build/build.mjs                 # dist/<name>/<version>/index.html (immutable, single file)
node build/build.mjs --promote       # also refresh dist/<name>/stable/
```
Release flow: bump `manifest.json` version + `CHANGELOG.md` → build → verify on
`beta/` in a real Manager business → `--promote` to `stable/` → tag
`git tag <name>/v<version>`. Rollback = re-promote a previous version. Never edit
a shipped `dist/<name>/<version>/`.

## Install into Manager.io
Manager → **Settings → Extensions → Add New Extension** → paste the channel URL
(e.g. `https://ext.esmeres.com/retainer-collections/stable/`). Per-client config
rides on the URL: `…/stable/?account=Retainer&currency=PHP`.

## Extensions
| Name | Title | Stable |
|---|---|---|
| [retainer-collections](extensions/retainer-collections) | Retainer Collections (Cash Basis) | 1.2.0 |
