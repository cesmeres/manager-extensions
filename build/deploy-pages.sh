#!/usr/bin/env bash
# Deploy the built dist/ to the gh-pages branch (what GitHub Pages serves).
# main stays source-only; gh-pages holds only the compiled single-file builds.
#   ./build/deploy-pages.sh
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

node build/build.mjs --promote

WT="$(mktemp -d)"
trap 'git worktree remove --force "$WT" >/dev/null 2>&1 || true' EXIT

# Fresh gh-pages from current HEAD; force-push is fine for a deploy branch.
git worktree add --force -B gh-pages "$WT" >/dev/null
cd "$WT"
git rm -rqf . >/dev/null 2>&1 || true
cp -R "$ROOT/dist/." .
touch .nojekyll                      # serve folder paths verbatim (no Jekyll)
git add -A
git commit -q -m "deploy: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
git push -qf -u origin gh-pages

OWNER_REPO="$(gh repo view --json nameWithOwner -q .nameWithOwner)"
USER="${OWNER_REPO%%/*}"; REPO="${OWNER_REPO##*/}"
echo "Deployed gh-pages."
echo "Base URL: https://${USER}.github.io/${REPO}/"
