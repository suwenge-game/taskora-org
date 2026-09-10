/*!
 * Lightweight Consent Mode v2 gate (shared across the game sites).
 * - Sets consent default to DENIED for ad_storage / ad_user_data /
 *   ad_personalization / analytics_storage BEFORE gtag.js loads.
 * - Restores a previously saved choice from localStorage.
 * - Injects the AdSense loader ONLY after ad consent is granted.
 * - Renders a minimal banner + "manage privacy choices" reopen entry.
 * No third-party CMP; certified-CMP signup (e.g. Funding Choices) is a
 * separate account-level step owned by the site operator.
 */
(function () {
  'use strict';

  var KEY = 'gh_consent_v1';
  var ADS_CLIENT = 'ca-pub-9132117639313977';

  var LANG = (document.documentElement.lang || 'en').slice(0, 2).toLowerCase();
  var zh = LANG === 'zh';
  var T = zh ? {
    title: '隐私选择',
    body: '我们使用 Cookie 提供广告与统计分析。你可以选择“仅必要”或全部接受，稍后可随时修改。',
    ads: '广告 Cookie（AdSense 个性化广告）',
    analytics: '分析 Cookie（GA4 流量统计）',
    accept: '全部接受',
    necessary: '仅必要',
    save: '保存选择',
    reopen: '隐私选择',
    policy: '隐私政策'
  } : {
    title: 'Privacy choices',
    body: 'We use cookies for advertising and analytics. Choose "Essential only" or accept all. You can change this at any time.',
    ads: 'Advertising cookies (personalised AdSense ads)',
    analytics: 'Analytics cookies (GA4 traffic stats)',
    accept: 'Accept all',
    necessary: 'Essential only',
    save: 'Save choices',
    reopen: 'Privacy choices',
    policy: 'Privacy policy'
  };

  var POLICY_PATHS = ['/privacy/', '/privacy.html'];

  function read() {
    try { return JSON.parse(localStorage.getItem(KEY)); } catch (e) { return null; }
  }
  function write(v) {
    try { localStorage.setItem(KEY, JSON.stringify(v)); } catch (e) { /* private mode */ }
  }
  function gtag() {
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push(arguments);
  }

  /* 1. Defaults MUST be pushed before gtag.js executes. */
  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push(['consent', 'default', {
    ad_storage: 'denied',
    ad_user_data: 'denied',
    ad_personalization: 'denied',
    analytics_storage: 'denied',
    wait_for_update: 500
  }]);

  function pushUpdate(ads, analytics) {
    gtag('consent', 'update', {
      ad_storage: ads ? 'granted' : 'denied',
      ad_user_data: ads ? 'granted' : 'denied',
      ad_personalization: ads ? 'granted' : 'denied',
      analytics_storage: analytics ? 'granted' : 'denied'
    });
  }

  /* 2. AdSense loader — injected only after ad consent. */
  var adsLoaded = false;
  function loadAds() {
    if (adsLoaded) return;
    adsLoaded = true;
    var s = document.createElement('script');
    s.async = true;
    s.src = 'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=' + ADS_CLIENT;
    s.crossOrigin = 'anonymous';
    s.setAttribute('data-consent-ads', '1');
    (document.head || document.documentElement).appendChild(s);
  }

  function apply(choice) {
    pushUpdate(choice.ads, choice.analytics);
    if (choice.ads) loadAds();
  }

  /* 3. Restore saved choice (no banner if already decided). */
  var saved = read();
  if (saved) apply(saved);

  /* 4. Minimal banner + reopen entry. */
  var ui = null;

  function close() {
    if (ui && ui.root.parentNode) ui.root.parentNode.removeChild(ui.root);
    ui = null;
  }

  function decide(ads, analytics) {
    var choice = { ads: !!ads, analytics: !!analytics, ts: Date.now() };
    write(choice);
    apply(choice);
    close();
  }

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text) n.textContent = text;
    return n;
  }

  function open() {
    if (ui) return;
    var saved2 = read();
    var root = el('div', 'ghc-root');
    root.setAttribute('role', 'dialog');
    root.setAttribute('aria-label', T.title);
    var panel = el('div', 'ghc-panel');
    panel.appendChild(el('h2', 'ghc-title', T.title));
    panel.appendChild(el('p', 'ghc-body', T.body));

    var rowAds = el('label', 'ghc-row');
    var cbAds = document.createElement('input');
    cbAds.type = 'checkbox';
    cbAds.checked = !saved2 || saved2.ads;
    rowAds.appendChild(cbAds);
    rowAds.appendChild(document.createTextNode(T.ads));

    var rowAn = el('label', 'ghc-row');
    var cbAn = document.createElement('input');
    cbAn.type = 'checkbox';
    cbAn.checked = !saved2 || saved2.analytics;
    rowAn.appendChild(cbAn);
    rowAn.appendChild(document.createTextNode(T.analytics));

    var actions = el('div', 'ghc-actions');
    var bAll = el('button', 'ghc-btn ghc-primary', T.accept);
    var bNeed = el('button', 'ghc-btn', T.necessary);
    var bSave = el('button', 'ghc-btn ghc-ghost', T.save);
    bAll.addEventListener('click', function () { decide(true, true); });
    bNeed.addEventListener('click', function () { decide(false, false); });
    bSave.addEventListener('click', function () { decide(cbAds.checked, cbAn.checked); });
    actions.appendChild(bAll); actions.appendChild(bNeed); actions.appendChild(bSave);

    panel.appendChild(rowAds);
    panel.appendChild(rowAn);
    panel.appendChild(actions);
    root.appendChild(panel);
    document.body.appendChild(root);
    ui = { root: root, cbAds: cbAds, cbAn: cbAn };
  }

  function injectStyle() {
    var css = '.ghc-root{position:fixed;left:0;right:0;bottom:0;z-index:2147483000;display:flex;justify-content:center;padding:12px;pointer-events:none}'
      + '.ghc-panel{pointer-events:auto;max-width:560px;width:100%;background:#fff;color:#1f2937;border:1px solid #d1d5db;border-radius:12px;box-shadow:0 8px 30px rgba(0,0,0,.18);padding:16px;font:14px/1.5 system-ui,-apple-system,Segoe UI,Roboto,sans-serif}'
      + '.ghc-title{margin:0 0 6px;font-size:16px;font-weight:600}'
      + '.ghc-body{margin:0 0 10px}'
      + '.ghc-row{display:flex;align-items:center;gap:8px;margin:4px 0;cursor:pointer}'
      + '.ghc-actions{display:flex;gap:8px;margin-top:12px;flex-wrap:wrap}'
      + '.ghc-btn{flex:1 1 auto;padding:8px 14px;border-radius:8px;border:1px solid #9ca3af;background:#fff;color:#111827;font-size:14px;cursor:pointer}'
      + '.ghc-primary{background:#111827;border-color:#111827;color:#fff}'
      + '.ghc-ghost{border-style:dashed}'
      + '.ghc-reopen{position:fixed;left:10px;bottom:10px;z-index:2147483000;padding:4px 10px;border-radius:999px;border:1px solid rgba(0,0,0,.25);background:rgba(255,255,255,.9);color:#111827;font:12px system-ui,sans-serif;cursor:pointer}'
      + '@media (prefers-color-scheme:dark){.ghc-panel{background:#111827;color:#e5e7eb;border-color:#374151}.ghc-btn{background:#1f2937;border-color:#4b5563;color:#e5e7eb}.ghc-primary{background:#e5e7eb;color:#111827;border-color:#e5e7eb}.ghc-reopen{background:rgba(17,24,39,.9);color:#e5e7eb}}';
    var st = document.createElement('style');
    st.textContent = css;
    document.head.appendChild(st);
  }

  function injectReopen() {
    if (document.querySelector('.ghc-reopen')) return;
    var b = el('button', 'ghc-reopen', T.reopen);
    b.setAttribute('aria-label', T.title);
    b.addEventListener('click', open);
    document.body.appendChild(b);
  }

  function boot() {
    injectStyle();
    injectReopen();
    if (!saved) open();
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

  /* 5. Public API for footer links / debugging. */
  window.GHConsent = {
    open: open,
    get: read,
    reset: function () { try { localStorage.removeItem(KEY); } catch (e) {} open(); }
  };
})();
