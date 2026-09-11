// Per-site build entry. Usage: node tools/build-kit/build.mjs <site-key> [--out DIR]
// Reads the site directory in place, applies transforms, writes to --out
// (default: <site>/_dist). The _dist dir is what gets deployed.
import { readdirSync, statSync, readFileSync, writeFileSync, mkdirSync, cpSync, existsSync } from 'node:fs';
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
// in-site mode: cwd has index.html AND (kit is the site's own tools/build-kit
// OR we're invoking the monorepo kit against the site dir containing cwd)
const inSiteRepo = existsSync(join(cwd, 'index.html')) &&
  (kitDir === join(cwd, 'tools', 'build-kit') || existsSync(join(cwd, 'tools', 'build-kit')));
const root = inSiteRepo ? dirname(cwd) : join(kitDir, '..', '..');
const siteKey = process.argv[2];
const site = SITES[siteKey];
if (!site) { console.error(`unknown site: ${siteKey}`); process.exit(1); }
const outIdx = process.argv.indexOf('--out');
const outArg = outIdx >= 0 ? process.argv[outIdx + 1] : null;
const outDir = outArg
  ? (outArg === '.' ? (inSiteRepo ? cwd : (() => { throw new Error('--out . requires running inside the site repo (cwd must contain index.html and tools/build-kit)'); })()) : outArg)
  : join(root, site.dir, '_dist');
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

// ---- pass 1: read all html/css/js, build class map if configured ----
const htmlFiles = files.filter((f) => /\.html?$/.test(f));
const cssFiles = files.filter((f) => /\.css$/.test(f));
const jsFiles = files.filter((f) => /\.js$/.test(f));

let classMap = null;
if (site.classPrefix) {
  const htmlTexts = htmlFiles.map((f) => readFileSync(f, 'utf8'));
  const cssTexts = cssFiles.map((f) => readFileSync(f, 'utf8'));
  const jsTexts = jsFiles.map((f) => readFileSync(f, 'utf8'));
  classMap = buildClassMap(site.classPrefix, cssTexts, htmlTexts, jsTexts);
  console.log(`class map: ${classMap.size} classes -> prefix "${site.classPrefix}"`);
}

// ---- pass 2: transform + write ----
mkdirSync(outDir, { recursive: true });
const report = { pages: 0, adsRemoved: 0, thin: [] };

for (const f of files) {
  const rel = relative(srcDir, f);
  const dest = join(outDir, rel);
  mkdirSync(dirname(dest), { recursive: true });
  const ext = extname(f);

  if (ext === '.html' || ext === '.htm') {
    let html = readFileSync(f, 'utf8');
    const relPosix = '/' + rel.replace(/\\/g, '/').replace(/(^|\/)index\.html?$/, '$1');
    const content = isContentPage(relPosix.replace(/index\.html?$/i, 'index.html'));

    if (classMap) html = obfuscateHtmlClasses(html, classMap);
    html = transformHead(html, { isContentPage: content });
    if (!content) {
      const r = stripAdUnits(html);
      html = r.html;
      report.adsRemoved += r.adsRemoved;
    }
    // density check on content pages
    if (content) {
      const { zh, en } = nativeTextStats(html);
      const needZh = site.lang.startsWith('zh') ? 800 : Infinity;
      const needEn = site.lang.startsWith('zh') ? Infinity : 600;
      if (zh < Math.min(needZh, 400) && en < Math.min(needEn, 250)) {
        report.thin.push({ page: rel, zh, en });
      }
    }
    writeFileSync(dest, finalize(html));
    report.pages++;
  } else if (f === dest) {
    // in-place build (--out .): destination IS the source — skip copying,
    // but still apply css/js obfuscation in place when configured.
    if (classMap && (ext === '.css' || ext === '.js')) {
      let text = readFileSync(f, 'utf8');
      text = ext === '.css' ? obfuscateCss(text, classMap) : obfuscateJsClasses(text, classMap);
      writeFileSync(dest, text);
    }
  } else if (classMap && (ext === '.css' || ext === '.js')) {
    let text = readFileSync(f, 'utf8');
    text = ext === '.css' ? obfuscateCss(text, classMap) : obfuscateJsClasses(text, classMap);
    writeFileSync(dest, text);
  } else {
    cpSync(f, dest);
  }
}
console.log(`built ${siteKey}: ${report.pages} pages, ${report.adsRemoved} ad units stripped from non-content pages`);
if (report.thin.length) {
  console.log(`THIN (${report.thin.length}):`);
  for (const t of report.thin) console.log(`  ${t.page} zh=${t.zh} en=${t.en}`);
}
