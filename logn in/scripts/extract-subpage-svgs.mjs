import { readFileSync, writeFileSync } from 'node:fs';

/**
 * Fold the sub-page display word glyph sets captured on 2026-10-01 into
 * src/content/displayHeadings.json.
 *
 * The source is `evidence/reference/raw/_subpage_svgs.json`, produced by walking each
 * route in the live tab (client-side `router.push`) and serialising every `<svg>` with
 * a positive rect. That file is ~550 KB, so this script — not a model read — is the
 * only sane way to get at it.
 *
 * Selection is by viewBox + path count + rendered rect, never by "the biggest SVG on
 * the page", because each route also carries dozens of 82x4 `underline-text-piece__decoration`
 * and small icon sets. Each pick is recorded with the rect it was measured at so a wrong
 * choice is auditable rather than silent.
 *
 * Run: node scripts/extract-subpage-svgs.mjs
 */
const SRC = 'evidence/reference/raw/_subpage_svgs.json';
const DST = 'src/content/displayHeadings.json';

/** key -> { route, match, measuredRect, note } */
const PICKS = {
  'about-title': {
    route: '/about',
    match: (s) => s.cls.includes('about-page-title') && s.cls.includes('sm-down'),
    rect: [849, 76, 508, 676],
    note: 'ABOUT word-mark, right column of the /about header',
  },
  'product-intro': {
    route: '/our-product',
    match: (s) => s.cls.includes('nexus-intro__title--desktop'),
    rect: [19, 20, 1338, 296],
    note: 'THE CARD variant used on /our-product (viewBox 1421x505, 7 paths)',
  },
  'pricing-title': {
    route: '/pricing',
    match: (s) => s.cls.includes('subscription-and-pricing__title-desktop'),
    rect: [19, 54, 1338, 411],
    note: 'SUBSCRIPTION word-mark. Rect taken from the settled measurement; the router-walk capture caught it mid-entry-animation at [19,-65,1338,0].',
  },
  'gift-card-title': {
    route: '/gift-card',
    match: (s) => s.vb === '0 0 667 383' && s.paths === 8,
    rect: [24, 73, 631, 362],
    note: 'GIFT CARD word-mark. The reference gives this svg NO class, so it is matched by viewBox + path count.',
  },
  'signin-wordmark': {
    route: '/signin',
    match: (s) => s.cls.includes('signin-decoration__title') && s.rect[2] > 0,
    rect: [19, 64, 650, 229],
    note: 'The giant FOLLOWART on the left of /signin. Two identical copies exist (one collapsed at 0x0); the visible one is picked.',
  },
  'signup-wordmark': {
    route: '/signup',
    match: (s) => s.cls.includes('signup-decoration__title') && s.rect[2] > 0,
    rect: [19, 64, 650, 229],
    note: 'The giant FOLLOWART on the left of /signup; same geometry as /signin, different tint context.',
  },
};

let src = JSON.parse(readFileSync(SRC, 'utf8'));
if (typeof src === 'string') src = JSON.parse(src);

const dst = JSON.parse(readFileSync(DST, 'utf8'));
const before = Object.keys(dst).length;
const report = [];

for (const [key, pick] of Object.entries(PICKS)) {
  const bucket = src.routes[pick.route];
  if (!bucket) { report.push(`${key}: NO ROUTE ${pick.route}`); continue; }
  const hits = bucket.svgs.filter(pick.match);
  if (!hits.length) { report.push(`${key}: no match in ${pick.route}`); continue; }
  // Prefer the rendered copy when the reference mounts a hidden duplicate.
  const best = hits.sort((a, b) => b.rect[2] * b.rect[3] - a.rect[2] * a.rect[3])[0];
  dst[key] = { class: best.cls, html: best.html, bytes: best.html.length };
  report.push(`${key.padEnd(18)} vb=${best.vb.padEnd(12)} paths=${String(best.paths).padStart(2)} rect=${JSON.stringify(best.rect)} ${(best.html.length / 1024).toFixed(1)}KB`);
}

writeFileSync(DST, JSON.stringify(dst, null, 2) + '\n');
console.log(report.join('\n'));
console.log(`displayHeadings.json: ${before} -> ${Object.keys(dst).length} entries`);
