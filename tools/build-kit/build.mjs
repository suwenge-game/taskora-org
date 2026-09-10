// Per-site build entry. Usage: node tools/build-kit/build.mjs <site-key> [--out DIR]
// Reads the site directory in place, applies transforms, writes to --out
// (default: <site>/_dist). The _dist dir is what gets deployed.
import { readdirSync, statSync, readFileSync, writeFileSync, mkdirSync, cpSync, rmSync, existsSync } from 'node:fs';
import { join, relative, extname, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SITES } from './config.mjs';
import { transformHead, stripAdUnits, nativeTextStats, isContentPage, finalize } from './transforms.mjs';
import { buildClassMap, obfuscateCss, obfuscateHtmlClasses, obfuscateJsClasses } from './obfuscate.mjs';

const kitDir = dirname(fileURLToPath(import.meta.url));
// Two run modes:
//  a) monorepo:  node tools/build-kit/build.mjs <key>  — reads <key>/, writes <key>/_dist
//  b) site repo: node tools/build-kit/build.mjs <key> --out . — repo root IS the site;
//     detected by the kit living at <cwd>/tools/build-kit.
const cwd = process.cwd();
const inSiteRepo = existsSync(join(cwd, 'index.html')) && kitDir === join(cwd, 'tools', 'build-kit');
const root = inSiteRepo ? dirname(cwd) : join(kitDir, '..', '..');
const siteKey = process.argv[2];
const site = SITES[siteKey];
if (!site) { console.error(`unknown site: ${siteKey}`); process.exit(1); }
const outIdx = process.argv.indexOf('--out');
const outArg = outIdx >= 0 ? process.argv[outIdx + 1] : null;
const outDir = outArg ? (outArg === '.' ? cwd : outArg) : join(root, site.dir, '_dist');
const srcDir = inSiteRepo ? cwd : join(root, site.dir);

// ---- collect files ----
function walk(dir, acc = []) {
  for (const name of readdirSync(dir)) {
    if (name === 'consent.js' && dirname(dir) === srcDir) continue; // retired CMP — never deploy
    if (name === '_dist' || name === 'node_modules' || name === '.git' || name === '.DS_Store' || name === '.github') continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, acc);
    else acc.push(p);
  }
  return acc;
}
const files = walk(srcDir);
