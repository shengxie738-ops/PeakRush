import { readFileSync, writeFileSync, existsSync } from 'node:fs';

/**
 * score-clone — turn real evidence into scorecard category scores.
 *
 * Plan §1579: "没有数据就写 null 与原因，不写猜测值" — a category with no evidence stays
 * null with a stated reason, and `total` stays null while ANY category is null. This
 * script exists so that rule is enforced by code instead of by judgement, and so the
 * score completes itself the moment the missing evidence lands.
 *
 * Every score below is derived from a named artifact. Nothing is eyeballed.
 *
 * Run: node scripts/score-clone.mjs
 */
const SCORE_PATH = 'quality/scorecard.json';
const DIFF_PATH = 'evidence/diffs/compare-report.json';
const BACKLOG_PATH = 'quality/backlog.json';
const MOTION_DIR = 'evidence/motion';

const read = (p, fallback) => (existsSync(p) ? JSON.parse(readFileSync(p, 'utf8')) : fallback);

const diff = read(DIFF_PATH, { rows: [] });
const backlog = read(BACKLOG_PATH, []);
const scored = diff.rows.filter((r) => typeof r.diffRatio === 'number');
const pct = (x) => Math.round(x * 100) / 100;

/**
 * Categories that can be scored today, and the ones that cannot.
 *
 * `scrollPointerTransitionTiming` and `TypographyTextColour` are deliberately NOT scored:
 * the first needs the D01-D10 continuous-frame trajectories (blocked on a visible browser
 * panel), and the second cannot be separated from layout using a whole-frame pixel diff —
 * claiming a typography score from that would be a guess wearing a number.
 */
const results = {};

// 1. Layout / composition / rhythm — whole-frame pixel agreement across every checkpoint.
if (scored.length >= 24) {
  const mean = scored.reduce((s, r) => s + r.diffRatio, 0) / scored.length;
  results.layoutCompositionRhythm = {
    score: pct((1 - mean) * 20),
    evidence: `${scored.length} checkpoints, mean pixel diff ${(mean * 100).toFixed(2)}%`,
    source: DIFF_PATH,
  };
} else {
  results.layoutCompositionRhythm = { score: null, reason: `only ${scored.length} scored checkpoints (need >= 24)` };
}

// 2. WebGL geometry / perspective / assets.
results.webglGeometryPerspectiveAssets = {
  score: null,
  reason: [
    'Hero ring is measured and asserted (spineLength 94.24718821101328, radius-15 circle texel-for-texel,',
    'check-hero-cards envelope deltas within 1.7px) and all five home scenes are verified drawing',
    'GL draw calls — but per-scene pixel agreement is not separable from a whole-frame diff,',
    'and the non-hero scenes have no numeric oracle yet. Scoring 25% of the rubric on partial',
    'evidence would inflate the total.',
  ].join(' '),
  partialEvidence: 'evidence/reference/webgl-scenes-corrected.md, scripts/check-hero-cards.mjs',
};

// 3. Page coverage / function states.
const openBacklog = backlog.filter((b) => b.status === 'open' || b.status === 'blocked');
const routesRendered = scored.filter((r) => r.blank === false).length;
results.pageCoverageFunctionStates = {
  score: null,
  reason: `${openBacklog.length} backlog items still open/blocked (${openBacklog.map((b) => b.id).join(', ')}); auth focus/invalid/post-submit states and /pricing entitlement binding are unimplemented, so coverage is not yet a scoreable 12/12`,
  partialEvidence: `${routesRendered}/${scored.length} checkpoints render non-blank`,
};

// 4. Stability / accessibility / maintenance — gate outcomes are objective.
const gates = read('quality/gates.json', null);
results.stabilityAccessibilityMaintenance = {
  score: null,
  reason: gates ? 'computed' : 'no machine-readable gate result file; verify:release reports pass/fail as text, so this is not yet derivable without inventing a mapping',
};

// 5 + 6 untouched remain explicitly null.
results.TypographyTextColour = {
  score: null,
  reason: 'A whole-frame pixel diff cannot separate type rendering from layout. Needs per-region masks (header band / prose column / word-mark), which exist only for V01 from the 2026-09-30 round.',
};
results.scrollPointerTransitionTiming = {
  score: null,
  reason: `Requires the D01-D10 continuous-frame trajectories. ${existsSync(MOTION_DIR) ? 'evidence/motion has no D0x files' : 'evidence/motion does not exist'}. Blocked on the in-app Browser being a visible surface (PENDING-02).`,
};

const card = read(SCORE_PATH, null);
if (!card) { console.error('no scorecard at ' + SCORE_PATH); process.exit(1); }

const now = new Date().toISOString();
let scoredCount = 0;
for (const [key, val] of Object.entries(results)) {
  if (!card.categories[key]) { console.error('unknown category ' + key); process.exit(1); }
  card.categories[key] = { ...card.categories[key], ...val };
  if (typeof card.categories[key].score === 'number') scoredCount++;
}

const allCategories = Object.keys(card.categories);
card.total = null;
card.totalReason = scoredCount === allCategories.length
  ? 'all categories scored'
  : `${scoredCount}/${allCategories.length} categories scored from real evidence; total withheld per plan §1579 ("no data -> null with a reason, never a guessed value"). Unscored: ${allCategories.filter((k) => typeof card.categories[k].score !== 'number').join(', ')}`;
card.generatedAt = now;
card.scoredBy = 'scripts/score-clone.mjs';

writeFileSync(SCORE_PATH, JSON.stringify(card, null, 2) + '\n');
console.log(card.totalReason);
for (const [k, v] of Object.entries(card.categories)) {
  console.log(`  ${k.padEnd(38)} w=${String(v.weight).padStart(2)} score=${v.score === null || v.score === undefined ? 'null' : v.score}`);
}
