// Build kit core: site-wide HTML transforms applied at compile time.
// Transforms are idempotent — running twice must be a no-op.
import { PUB_ID, NO_AD_PATTERNS } from './config.mjs';

const CONSENT_SRC = /<script src="\/consent\.js"><\/script>\s*/g;

// Consent Mode v2 defaults pushed before ANY Google script executes.
function consentDefaultSnippet() {
  return `<script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}gtag('consent','default',{ad_storage:'denied',ad_user_data:'denied',ad_personalization:'denied',analytics_storage:'denied',wait_for_update:500});</script>`;
}

// Certified CMP note: Funding Choices (Privacy & Messaging) is account-level.
// The gtag consent default here is the minimal code-side requirement; FC injects
// its own banner at runtime when enabled in the AdSense UI.
function adsenseLoaderSnippet() {
  return `<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${PUB_ID}" crossorigin="anonymous"></script>`;
}

function fcSnippet() {
  // Funding Choices privacy & messaging — account-level; kept as data-fc marker
  // so the operator can flip it on by pasting the real FC site id (same for all sites).
  return `<!-- Funding Choices (Privacy & Messaging) is enabled at account level; TCF banner served by Google when live. -->`;
}

/**
 * Transform head: remove local consent.js, ensure consent default precedes
 * gtag/adsense, add async adsense loader (content pages only).
 * Idempotent by construction (removes old markers, then adds missing ones).
 */
export function transformHead(html, { isContentPage }) {
  html = html.replace(CONSENT_SRC, '');
  // Remove any previously injected snippets from an earlier build.
  html = html.replace(/<script>window\.dataLayer=window\.dataLayer\|\|\[\];function gtag\(\)[\s\S]*?<\/script>\s*/g, '');
  html = html.replace(/<script async src="https:\/\/pagead2\.googlesyndication\.com[^"]*"[^>]*><\/script>\s*/g, '');
  html = html.replace(/<!-- Funding Choices \(Privacy & Messaging\)[^>]*-->\s*/g, '');

  // Insert consent default + (for content pages) adsense loader right after <head> meta
  // but BEFORE the gtag.js script if present.
  const inject = consentDefaultSnippet() + fcSnippet() + (isContentPage ? adsenseLoaderSnippet() : '');
  const gtagIdx = html.indexOf('<script async src="https://www.googletagmanager.com/gtag/js');
  if (gtagIdx >= 0) {
    html = html.slice(0, gtagIdx) + inject + '\n' + html.slice(gtagIdx);
  } else {
    const headClose = html.indexOf('</head>');
    html = html.slice(0, headClose) + inject + '\n' + html.slice(headClose);
  }
  return html;
}

/**
 * Remove ad units from non-content pages (defense in depth).
 * Returns { html, adsRemoved }.
 */
export function stripAdUnits(html) {
  let adsRemoved = 0;
  html = html.replace(/<ins class="adsbygoogle"[\s\S]*?<\/ins>\s*/g, () => { adsRemoved++; return ''; });
  html = html.replace(/<script>\s*\(adsbygoogle\s*=\s*window\.adsbygoogle\s*\|\|\s*\[\]\)\.push\(\{[\s\S]*?\}\);?\s*<\/script>\s*/g, () => { adsRemoved++; return ''; });
  return { html, adsRemoved };
}

/** Inject a static first-screen skeleton into an empty game mount. */
export function injectStaticSkeleton(html, mountSelector, skeletonHtml) {
  const re = new RegExp(`(<div[^>]*${mountSelector}[^>]*>)([\\s\\S]*?)(</div>)`);
  if (!re.test(html)) return html;
  return html.replace(re, (m, open, inner, close) => {
    if (inner.trim()) return m; // already has static content
    return open + skeletonHtml + close;
  });
}

/** Build-time QA: first-screen native text density. */
export function nativeTextStats(html) {
  const t = html
    .replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, '')
    .replace(/<[^>]+>/g, ' ');
  const text = t.replace(/&[a-z]+;/gi, ' ');
  const zh = (text.match(/[\u4e00-\u9fff]/g) || []).length;
  const en = (text.match(/[A-Za-z]+/g) || []).length;
  return { zh, en };
}

export function isContentPage(relPath) {
  return !NO_AD_PATTERNS.some((re) => re.test('/' + relPath.replace(/\\/g, '/')));
}

/** Serialize pages deterministically for git-friendly diffs. */
export function finalize(html) {
  return html.replace(/\n{3,}/g, '\n\n').trimEnd() + '\n';
}
