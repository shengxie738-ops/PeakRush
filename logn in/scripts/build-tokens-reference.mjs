import { readFileSync, writeFileSync, readdirSync } from 'node:fs';

/**
 * Builds design/tokens.reference.json by scanning the reference's own compiled CSS
 * chunks. Nothing is typed by hand: every emitted value carries the chunk it was
 * found in, so a reviewer can grep the same string back to source.
 *
 * Statuses follow plan §2.2: MEASURED = read out of the frozen reference capture.
 * Anything the scan cannot locate is reported as missing rather than guessed.
 */
const DIR = 'evidence/reference/raw/_nuxt';
const chunks = readdirSync(DIR).filter((f) => f.endsWith('.css'));
const sources = chunks.map((f) => ({ file: `${DIR}/${f}`, name: f, text: readFileSync(`${DIR}/${f}`, 'utf8') }));

const find = (re) => {
  const hits = [];
  for (const s of sources) {
    let m;
    const r = new RegExp(re.source, re.flags.includes('g') ? re.flags : re.flags + 'g');
    while ((m = r.exec(s.text)) !== null) hits.push({ name: s.name, at: m.index, full: m[0], groups: m.slice(1) });
  }
  return hits;
};

const colors = {};
for (const h of find(/--(c-[a-z0-9-]+)\s*:\s*(#[0-9a-fA-F]{3,8}|rgba?\([^)]*\))\s*;/g)) {
  const [token, value] = h.groups;
  if (!colors[token]) colors[token] = { value, unit: 'css-color', evidenceId: h.name, status: 'MEASURED' };
}

const scalePx = find(/--scale-px\s*:\s*([^;}]+)/g).map((h) => ({ value: h.groups[0].trim(), evidenceId: h.name, status: 'MEASURED' }));

const themeCandidates = new Map();
/** The reference authors its theme blocks as comma-separated selector lists
 *  (`.ui-blue,.ui-dark,…,.ui-print{…}`) for the shared defaults AND as single-class
 *  rules for each theme's overrides. The shared rule appears first in the cascade, so
 *  "first match wins" would record the defaults as if they were the theme — a wrong
 *  but green artefact. Keep every candidate and prefer the most specific selector. */
for (const h of find(/([^{}/]*\.ui-[a-z][^{}/]*)\{([^}]*)\}/gi)) {
  const [selector, body] = h.groups;
  const maps = {};
  for (const m of body.matchAll(/--(t-[a-z0-9_-]+)\s*:\s*([^;}]+);/g)) maps[m[1]] = m[2].trim();
  if (!Object.keys(maps).length) continue;
  const named = selector
    .split(',')
    .map((x) => x.trim())
    .filter((x) => /^\.ui-[a-z]+$/.test(x))
    .map((x) => x.slice(1));
  for (const theme of named) {
    const entry = { mappings: maps, evidenceId: h.name, status: 'MEASURED', selector: selector.trim().slice(0, 160), specificity: named.length };
    const list = themeCandidates.get(theme) ?? [];
    list.push(entry);
    themeCandidates.set(theme, list);
  }
}
const themes = {};
for (const [theme, list] of themeCandidates) {
  const best = list.reduce((a, b) => (b.specificity < a.specificity ? b : a));
  const merged = {};
  for (const c of list) Object.assign(merged, c.mappings);
  themes[theme] = {
    mappings: best.mappings,
    fullCascade: merged,
    chosenFrom: best.selector,
    chosenBecause: `${best.specificity === 1 ? 'single-class override' : best.specificity + '-theme shared rule'}; ${list.length} matching rule(s) in ${best.evidenceId}`,
    evidenceId: best.evidenceId,
    status: 'MEASURED',
  };
}

const spacing = {};
for (const h of find(/--(spacing[a-z0-9-]*|sm|md|lg|xl|xxl|xxxl|xxxxl|n-[a-z]+)\s*:\s*([^;}]+);/g)) {
  if (!spacing[h.groups[0]]) spacing[h.groups[0]] = { value: h.groups[1].trim(), evidenceId: h.name, status: 'MEASURED' };
}

const fontFaces = find(/@font-face\s*\{([^}]*)\}/g).map((h) => {
  const body = h.groups[0];
  const grab = (k) => (new RegExp(`${k}\\s*:\\s*([^;}]+)`).exec(body) || [])[1]?.trim() ?? null;
  return { family: grab('font-family'), weight: grab('font-weight'), style: grab('font-style'), display: grab('font-display'), src: grab('src'), evidenceId: h.name, status: 'MEASURED' };
});

const typeRules = {};
for (const h of find(/\.(text-[a-z0-9-]+)\s*\{([^}]*)\}/g)) {
  const [cls, body] = h.groups;
  const props = {};
  for (const m of body.matchAll(/(font-size|line-height|letter-spacing|font-weight|font-family|text-transform)\s*:\s*([^;}]+);/g)) props[m[1]] = m[2].trim();
  if (Object.keys(props).length && !typeRules[cls]) typeRules[cls] = { properties: props, evidenceId: h.name, status: 'MEASURED' };
}

const breakpoints = find(/@media[^{]{0,120}/g).slice(0, 60).map((h) => ({ query: h.full.trim(), evidenceId: h.name }));

const out = {
  generatedBy: 'scripts/build-tokens-reference.mjs',
  source: 'evidence/reference/raw/_nuxt/*.css (frozen reference capture)',
  referenceLock: 'evidence/reference-lock.json',
  policy: 'Values are read out of the reference chunks. Engineering defaults do not belong in this file and are never written back here (plan §6.2).',
  colors,
  scalePx,
  themes,
  spacingAndPairs: spacing,
  typographyUtilityClasses: typeRules,
  fontFaces,
  mediaQueriesSeen: breakpoints.length,
  mediaQuerySamples: breakpoints.slice(0, 12),
  gaps: {
    colorsFound: Object.keys(colors).length,
    themesFound: Object.keys(themes).length,
    typeClassesFound: Object.keys(typeRules).length,
    note: Object.keys(colors).length === 0 ? 'colour tokens were not found in the captured chunks — they may live in a stylesheet that was not requested by the landing page' : 'none',
  },
};

writeFileSync('design/tokens.reference.json', JSON.stringify(out, null, 2));
console.log(JSON.stringify({ chunks: chunks.length, colors: Object.keys(colors).length, themes: Object.keys(themes).length, typeClasses: Object.keys(typeRules).length, scalePx, fontFaces: fontFaces.length, mediaQueries: breakpoints.length }, null, 2));
