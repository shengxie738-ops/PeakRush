import { chromium } from '@playwright/test';
import { readFileSync, writeFileSync } from 'node:fs';
import { PNG } from 'pngjs';
import pixelmatch from 'pixelmatch';

/**
 * diff-hero-phase.mjs — separate animation phase from real static error.
 *
 * The first reference screenshot produced a 13.8% pixel diff on the hero. Most of that is not a
 * defect: the reference ring rotates continuously at -0.05 turns/s, so any two captures taken at
 * different wall-clock moments show different cards in the band. Comparing them pixel-for-pixel
 * measures timing, not fidelity.
 *
 * The ring is 9-fold symmetric, so only 1/9 of a turn (2.222 s) is a distinct phase. This script
 * pins the clone's clock across that window with `?heroTimeSec=`, and reports the diff at each
 * phase plus the phase that matches best. The minimum is the honest static-fidelity number; the
 * spread across phases is how much of the raw diff was timing.
 *
 * Usage: node scripts/diff-hero-phase.mjs [steps]
 */
const STEPS = Number(process.argv[2] ?? 12);
const REF = 'evidence/reference/captured/V01-_@primary.png';
const BASE = 'http://127.0.0.1:5175/';
const SLOT_SECONDS = 1 / 9 / 0.05; // 2.2222s — one card slot of rotation

const ref = PNG.sync.read(readFileSync(REF));
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1376, height: 772 }, deviceScaleFactor: 1.5 });
const page = await ctx.newPage();

const rows = [];
let best = null;
for (let i = 0; i < STEPS; i++) {
  const t = (i / STEPS) * SLOT_SECONDS;
  await page.goto(`${BASE}?heroTimeSec=${t.toFixed(4)}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1200);
  const buf = await page.screenshot({ type: 'png' });
  const clone = PNG.sync.read(Buffer.from(buf));
  if (clone.width !== ref.width || clone.height !== ref.height) {
    rows.push({ tSec: +t.toFixed(3), status: `SIZE_${clone.width}x${clone.height}` });
    continue;
  }
  const diff = new PNG({ width: ref.width, height: ref.height });
  const changed = pixelmatch(ref.data, clone.data, diff.data, ref.width, ref.height, { threshold: 0.1 });
  const ratio = changed / (ref.width * ref.height);
  rows.push({ tSec: +t.toFixed(3), spinTurns: +(-0.05 * t).toFixed(4), diffPixels: changed, diffRatio: +ratio.toFixed(4) });
  if (!best || ratio < best.diffRatio) {
    best = { tSec: +t.toFixed(3), diffRatio: +ratio.toFixed(4) };
    writeFileSync('evidence/diffs/V01-hero-phase-best.png', PNG.sync.write(clone));
    writeFileSync('evidence/diffs/V01-hero-phase-diff.png', PNG.sync.write(diff));
  }
  console.log(`  t=${t.toFixed(3)}s spin=${(-0.05 * t).toFixed(4)} turns  diff ${ratio.toFixed(4)}`);
}
await browser.close();

const ratios = rows.map((r) => r.diffRatio).filter((v) => typeof v === 'number');
const report = {
  generatedAt: new Date().toISOString(),
  reference: REF,
  viewport: '1376x772@1.5',
  slotPeriodSeconds: +SLOT_SECONDS.toFixed(4),
  steps: rows,
  worst: Math.max(...ratios),
  best,
  spread: +(Math.max(...ratios) - Math.min(...ratios)).toFixed(4),
  interpretation:
    'best.diffRatio is the static-fidelity number for the hero (phase-aligned). The spread across ' +
    'phases is the part of a naive single-shot diff that is pure animation timing, not error.',
};
writeFileSync('evidence/diffs/hero-phase-report.json', JSON.stringify(report, null, 2));
console.log(JSON.stringify({ best, worst: report.worst, spread: report.spread }, null, 2));
