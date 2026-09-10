// Per-site build configuration. Single source of truth for the build kit.
export const PUB_ID = 'ca-pub-9132117639313977';

export const SITES = {
  'pipely-xyz': {
    dir: 'pipely-xyz',
    domain: 'https://pipely.xyz',
    lang: 'zh-CN',
    ga: 'G-Q087PKG27K',
    hosting: 'gh-pages',   // GitHub repo -> Actions build -> Pages -> Cloudflare front
    brand: '连连看词场',
  },
  'game3': {
    dir: 'game3',
    domain: 'https://deskgamehub.site',
    lang: 'zh-Hans',
    ga: 'G-ZZRWJGN7MX',
    hosting: 'cf-pages',   // CF Pages git integration serves repo root
    brand: '6×6 Mini Sudoku',
  },
  'gamehub-city': {
    dir: 'gamehub-city',
    domain: 'https://gamehub.city',
    lang: 'en',
    ga: 'G-Q087PKG27K',
    hosting: 'gh-pages',
    brand: 'Daily Riddle Words',
    classPrefix: 'gw',     // CSS class-hash obfuscation
  },
  'taskora-org': {
    dir: 'taskora-org',
    domain: 'https://taskora.org',
    lang: 'en',
    ga: 'G-Q087PKG27K',
    hosting: 'gh-pages',
    brand: 'Numble Daily',
    classPrefix: 'tq',     // CSS class-hash obfuscation
  },
  'game1': {
    dir: 'game1',
    domain: 'https://deskgame.xyz',
    lang: 'en',
    ga: 'G-K11J4PCW59',
    hosting: 'cf-pages',
    brand: 'DeskGame 2048',
  },
  'game2': {
    dir: 'game2',
    domain: 'https://deskgamehub.online',
    lang: 'en',
    ga: 'G-Q087PKG27K',
    hosting: 'cf-pages',
    brand: 'GameHub',
  },
};

// Pages that must NOT carry any ad unit. Everything else content-ish may carry
// manual display units (1 per page, in-article), subject to the same rule.
export const NO_AD_PATTERNS = [
  /\/404\.html?$/,
  /\/(privacy|terms|contact|about|editorial-policy|privacy-policy|terms-of-service|about-us)\.html?$/i,
  /\/(privacy|terms|contact|about|editorial-policy|privacy-policy|terms-of-service|about-us)\/(index\.html)?$/i,
];

// Content pages must meet first-screen native-text density:
// >= 600 English words OR >= 800 CJK chars (per task spec).
export const DENSITY = {
  zhChars: 800,
  enWords: 600,
  indexMin: { zhChars: 400, enWords: 250 },
};

export const AD_MARGIN_PX = { nearControls: [160, 200], content: [64, 96] };
