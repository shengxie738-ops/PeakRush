import { readFileSync, writeFileSync } from 'node:fs';
import { PNG } from 'pngjs';
import { heroProjectionReport } from './project-hero.mjs';

/**
 * Hero card presence gate.
 *
 * "live=3" only proves a renderer attached; it says nothing about whether the picture is
 * right, so this compares a clone screenshot against the REFERENCE'S OWN reconstructed
 * card layout rather than against a remembered impression of it.
 *
 * HISTORY (do not repeat): this gate used to assert `leftmostCropped: byX[0].x <= 2`,
 * claiming the reference crops a hero card at the left canvas edge. That was never
 * measured — no reference screenshot baseline exists (PENDING-01). Three rounds of
 * tuning (ring phase, pathSegment, radius 15 -> 12.9) were spent chasing it. The live
 * reference has now been read directly (evidence/reference/scenes-measured.json): the
 * spine is a radius-15 circle, spineLength = 94.24718821101328, spineOffset = 161,
 * per-card pathOffset = i/9, and the projection matrix gives fov 29.2518 at aspect
 * 1.7824. Reconstructing those facts puts the reference's textured-card envelope at
 * x [308, 1114] for a 1440x900 canvas — it does NOT reach x = 0, and because the ring is
 * 9-fold symmetric the envelope is identical at every idle phase. The old target was
 * unreachable by design; asserting it kept the gate red for a defect that does not exist.
 *
 * The gate is therefore: the clone's dark card regions must sit inside the reconstructed
 * envelope within tolerance, be card-sized, and run on a rising diagonal.
 *
 * Usage: node scripts/check-hero-cards.mjs [path.png] [--tolerance=32]
 */
const file = process.argv[2] ?? 'evidence/local/V01-_@primary.png';
const tolArg = process.argv.find((a) => a.startsWith('--tolerance='));
const TOLERANCE = tolArg ? Number(tolArg.split('=')[1]) : 32;

const png = PNG.sync.read(readFileSync(file));
const { width, height, data } = png;

const isDark = (x, y) => {
  const i = (y * width + x) * 4;
  const r = data[i], g = data[i + 1], b = data[i + 2];
  return r < 70 && g < 70 && b < 70;
};

const visited = new Uint8Array(width * height);
const blobs = [];
const stack = new Int32Array(width * height);

for (let y0 = 0; y0 < height; y0++) {
  for (let x0 = 0; x0 < width; x0++) {
    const idx0 = y0 * width + x0;
    if (visited[idx0] || !isDark(x0, y0)) continue;
    let sp = 0;
    stack[sp++] = idx0;
    visited[idx0] = 1;
    let minX = x0, maxX = x0, minY = y0, maxY = y0, area = 0;
    while (sp > 0) {
      const idx = stack[--sp];
      const x = idx % width, y = (idx / width) | 0;
      area++;
      if (x < minX) minX = x; if (x > maxX) maxX = x;
      if (y < minY) minY = y; if (y > maxY) maxY = y;
      for (const [nx, ny] of [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]]) {
        if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
        const nidx = ny * width + nx;
        if (visited[nidx] || !isDark(nx, ny)) continue;
        visited[nidx] = 1;
        if (sp < stack.length) stack[sp++] = nidx;
      }
    }
    if (area > (width * height) * 0.004) blobs.push({ x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1, area });
  }
}

blobs.sort((a, b) => b.area - b.area);
const cards = blobs.slice(0, 8);
const byX = [...cards].sort((a, b) => a.x - b.x);
const rising = byX.length > 1 && byX[byX.length - 1].y < byX[0].y;

// Only the textured (near-layer) cards can read as dark artwork; the far layer is solid
// #B05A2E and is composited behind them, so the oracle's near-band is the right bound.
const oracle = heroProjectionReport({ width, height, spin: 0, mouse: 0.5 });
const nearCards = oracle.cards.filter((c) => c.minX !== undefined && c.samples > 0);
const expected = {
  envelopeX: [
    Math.min(...nearCards.map((c) => c.minX)),
    Math.max(...nearCards.map((c) => c.maxX)),
  ],
  envelopeY: [
    Math.min(...nearCards.map((c) => c.minY)),
    Math.max(...nearCards.map((c) => c.maxY)),
  ],
  visibleCardsUnion: nearCards.length,
  fov: +oracle.fov.toFixed(4),
};

const observedMinX = byX.length ? byX[0].x : Infinity;
const observedMaxX = byX.length ? Math.max(...byX.map((c) => c.x + c.w)) : -Infinity;
const observedMinY = Math.min(...byX.map((c) => c.y));
const observedMaxY = Math.max(...byX.map((c) => c.y + c.h));

const checks = {
  darkRegionsFound: blobs.length,
  cardSizedRegions: cards.length,
  atLeastFourVisible: cards.length >= 4,
  risingDiagonal: rising,
  leftEdgeMatchesReference:
    Math.abs(observedMinX - expected.envelopeX[0]) <= TOLERANCE,
  rightEdgeMatchesReference:
    Math.abs(observedMaxX - expected.envelopeX[1]) <= TOLERANCE,
  topEdgeMatchesReference: Math.abs(observedMinY - expected.envelopeY[0]) <= TOLERANCE,
  bottomEdgeMatchesReference: Math.abs(observedMaxY - expected.envelopeY[1]) <= TOLERANCE,
  totalDarkCoverage: +(blobs.reduce((s, b) => s + b.area, 0) / (width * height)).toFixed(4),
};
checks.pass =
  checks.atLeastFourVisible &&
  checks.risingDiagonal &&
  checks.leftEdgeMatchesReference &&
  checks.rightEdgeMatchesReference;

const report = {
  file,
  viewport: [width, height],
  tolerancePx: TOLERANCE,
  oracle: {
    source: 'evidence/reference/scenes-measured.json + evidence/reference/shaders/hero-summary.json',
    spineLength: +oracle.spineLength.toFixed(10),
    expected,
    note: 'envelope is spin-invariant: the ring has 9-fold symmetry, so idle phase permutes cards without moving the band',
  },
  observed: {
    x: [observedMinX, observedMaxX],
    y: [observedMinY, observedMaxY],
  },
  deltas: {
    left: +(observedMinX - expected.envelopeX[0]).toFixed(1),
    right: +(observedMaxX - expected.envelopeX[1]).toFixed(1),
    top: +(observedMinY - expected.envelopeY[0]).toFixed(1),
    bottom: +(observedMaxY - expected.envelopeY[1]).toFixed(1),
  },
  checks,
  regions: cards,
};
writeFileSync('evidence/diffs/hero-cards.json', JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
process.exit(checks.pass ? 0 : 1);
