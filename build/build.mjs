#!/usr/bin/env node
/* Build every extension into an immutable, single-file artifact.
 *
 *   node build/build.mjs                 build all → dist/<name>/<version>/index.html
 *   node build/build.mjs --promote       also copy each build into dist/<name>/stable/
 *   node build/build.mjs retainer-collections   build just one
 *
 * "Single file" = inline every  <script src="local.js">  so the hosted artifact
 * has no relative-path or load-order fragility inside Manager's iframe.
 */
import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync, rmSync, cpSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const EXT_DIR = join(ROOT, 'extensions');
const DIST = join(ROOT, 'dist');

const args = process.argv.slice(2);
const promote = args.includes('--promote');
const only = args.filter(a => !a.startsWith('--'));

function inlineLocalScripts(html, srcDir) {
  // Replace <script src="foo.js"></script> (local, non-URL) with inline contents.
  return html.replace(/<script\s+src=["']([^"':]+?)["']\s*>\s*<\/script>/gi, (m, src) => {
    const p = join(srcDir, src);
    if (!existsSync(p)) { console.warn(`  ! referenced script not found, left as-is: ${src}`); return m; }
    const code = readFileSync(p, 'utf8');
    return `<script>\n/* inlined: ${src} */\n${code}\n</script>`;
  });
}

const names = readdirSync(EXT_DIR).filter(n =>
  existsSync(join(EXT_DIR, n, 'manifest.json')) && (!only.length || only.includes(n)));

if (!names.length) { console.error('No extensions to build.'); process.exit(1); }

for (const name of names) {
  const dir = join(EXT_DIR, name);
  const manifest = JSON.parse(readFileSync(join(dir, 'manifest.json'), 'utf8'));
  const entry = manifest.entry || 'src/index.html';
  const srcDir = join(dir, dirname(entry));
  const html = readFileSync(join(dir, entry), 'utf8');
  const out = inlineLocalScripts(html, srcDir);

  const verDir = join(DIST, name, manifest.version);
  mkdirSync(verDir, { recursive: true });
  writeFileSync(join(verDir, 'index.html'), out);
  console.log(`✓ ${name} ${manifest.version} → dist/${name}/${manifest.version}/index.html (${out.length.toLocaleString()} bytes, single file)`);

  if (promote) {
    const stable = join(DIST, name, 'stable');
    rmSync(stable, { recursive: true, force: true });
    mkdirSync(stable, { recursive: true });
    cpSync(join(verDir, 'index.html'), join(stable, 'index.html'));
    console.log(`  ↳ promoted to dist/${name}/stable/`);
  }
}
console.log('\nDone. Host dist/ behind ext.esmeres.com. Never edit a shipped <version>/ folder.');
