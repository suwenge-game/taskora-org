// CSS class-hash obfuscation for anti-homogenization (Phase 2).
// Rewrites class names in CSS + HTML with a site-prefixed content hash,
// so two sites sharing a template no longer share class-name fingerprints.
import { createHash } from 'node:crypto';

/** Pull class-name tokens out of JS strings (innerHTML markup, selectors). */
function jsClassNames(js) {
  const names = new Set();
  const attrRe = /class=["']([^"']+)["']/g;
  let m;
  while ((m = attrRe.exec(js))) {
    for (const cls of m[1].split(/\s+/)) {
      if (/^[a-zA-Z][a-zA-Z0-9_-]*$/.test(cls)) names.add(cls);
    }
  }
  const selRe = /querySelector(?:All)?\((['"`])[^'"`]*?\.([a-zA-Z][a-zA-Z0-9_-]*)/g;
  while ((m = selRe.exec(js))) names.add(m[2]);
  return names;
}

/**
 * Build a rename map for a site. Class names found in CSS, HTML and JS get
 * `{prefix}_{hash8}` where hash8 = sha1(prefix|className).slice(0,8).
 * JS-discovered names matter: game modules inject DOM with their own classes.
 */
export function buildClassMap(prefix, cssTexts, htmlTexts, jsTexts) {
  const names = new Set();
  const classRe = /\.([a-zA-Z][a-zA-Z0-9_-]+)/g;
  for (const css of cssTexts) {
    let m;
    while ((m = classRe.exec(css))) names.add(m[1]);
  }
  const htmlClassRe = /class="([^"]+)"/g;
  for (const html of htmlTexts) {
    let m;
    while ((m = htmlClassRe.exec(html))) {
      for (const cls of m[1].split(/\s+/)) {
        if (/^[a-zA-Z][a-zA-Z0-9_-]*$/.test(cls)) names.add(cls);
      }
    }
  }
  for (const js of jsTexts) for (const n of jsClassNames(js)) names.add(n);
  const map = new Map();
  for (const name of [...names].sort()) {
    const h = createHash('sha1').update(`${prefix}|${name}`).digest('hex').slice(0, 8);
    map.set(name, `${prefix}_${h}`);
  }
  return map;
}

/** Escape a plain token for regex use. */
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Apply the map to CSS text. */
export function obfuscateCss(css, map) {
  let out = css;
  for (const [from, to] of map) {
    out = out.replace(new RegExp(`\\.${esc(from)}\\b`, 'g'), `.${to}`);
  }
  return out;
}

/** Apply to HTML class="..." attributes only (not URLs / text). */
export function obfuscateHtmlClasses(html, map) {
  return html.replace(/class="([^"]*)"/g, (m, cls) => {
    const renamed = cls.split(/\s+/).map((c) => map.get(c) || c).join(' ');
    return `class="${renamed}"`;
  });
}

/** Apply to JS: selector calls AND class="..." / class='...' inside innerHTML strings. */
export function obfuscateJsClasses(js, map) {
  let out = js;
  for (const [from, to] of map) {
    out = out
      // querySelector(".cls") / ('.cls') / (`.cls ...`) — dot + name at selector start
      .replace(new RegExp(`(querySelector(?:All)?\\((['"\`])[^'"\`]*?\\.)${esc(from)}\\b`, 'g'), `$1${to}`)
      .replace(new RegExp(`(classList\\.(?:add|remove|toggle|contains)\\(['"\`])${esc(from)}(['"\`])`, 'g'), `$1${to}$2`)
      .replace(new RegExp(`(className\\s*=\\s*['"\`][^'"\`]*\\b)${esc(from)}\\b`, 'g'), `$1${to}`)
      // class="ng-top" etc. inside innerHTML template strings (both quote styles)
      .replace(new RegExp(`(class=")${esc(from)}(")`, 'g'), `$1${to}$2`)
      .replace(new RegExp(`(class=")([^"]*?\\s)${esc(from)}(")`, 'g'), `$1$2${to}$3`)
      .replace(new RegExp(`(class=')${esc(from)}(')`, 'g'), `$1${to}$2`)
      .replace(new RegExp(`(class=')([^']*?\\s)${esc(from)}(')`, 'g'), `$1$2${to}$3`);
  }
  return out;
}
