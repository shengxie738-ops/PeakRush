import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from 'node:fs';
import { PNG } from 'pngjs';
import pixelmatch from 'pixelmatch';

/**
 * compare:reference — pairs frozen reference frames with evidence/local/<id>*.png and
 * reports the pixel diff. The reference side is read only; nothing here can write into
 * evidence/reference.
 *
 * Reference frames live in dated freeze folders (captured/2026-10-01/) as well as the
 * legacy captured/capture-report.json, because reference pixels can only be taken while
 * the in-app panel happens to be a visible surface and each session is recorded
 * separately. Every freeze is a candidate; for a given id+viewport the newest freeze wins,
 * so re-capturing a checkpoint sharpens it instead of forking the baseline.
 */
const REF = 'evidence/reference/captured';
const LOC = 'evidence/local';
const OUT = 'evidence/diffs';
if (!existsSync(OUT)) mkdirSync(OUT, { recursive: true });

const loadRecords = (path) => {
  if (!existsSync(path)) return [];
  try {
    return JSON.parse(readFileSync(path, 'utf8')).records ?? [];
  } catch {
    return [];
  }
};

/** @returns {Array<object>} one record per id+viewport, newest freeze first-wins then overwritten */
const aggregateReference = () => {
  const reports = [REF + '/capture-report.json'];
  if (existsSync(REF)) {
    for (const ent of readdirSync(REF, { withFileTypes: true })) {
      if (ent.isDirectory()) reports.push(`${REF}/${ent.name}/capture-report.json`);
    }
  }
  const byKey = new Map();
  for (const path of reports) {
    // Later freeze folders sort after earlier ones, so a plain overwrite prefers the newest.
    for (const rec of loadRecords(path)) byKey.set(`${rec.id}|${rec.viewport}`, rec);
  }
  return [...byKey.values()];
};

const refReport = aggregateReference();
const locReport = loadRecords(LOC + '/capture-report.json');
if (refReport.length === 0) {
  console.log(JSON.stringify({ status: 'BLOCKED', reason: 'no frozen reference capture in ' + REF + ' — run capture:reference first', localRecords: locReport.length }, null, 2));
  process.exit(1);
}

const rows = [];
for (const ref of refReport) {
  const loc = locReport.find((r) => r.id === ref.id && r.viewport === ref.viewport);
  if (!loc) { rows.push({ id: ref.id, status: 'MISSING_LOCAL' }); continue; }
  const a = PNG.sync.read(readFileSync(ref.file));
  const b = PNG.sync.read(readFileSync(loc.file));
  if (a.width !== b.width || a.height !== b.height) { rows.push({ id: ref.id, status: 'SIZE_MISMATCH', ref: [a.width, a.height], local: [b.width, b.height] }); continue; }
  const diff = new PNG({ width: a.width, height: a.height });
  const changed = pixelmatch(a.data, b.data, diff.data, a.width, a.height, { threshold: 0.1 });
  const path = `${OUT}/${ref.id}-diff.png`;
  writeFileSync(path, PNG.sync.write(diff));
  const ratio = changed / (a.width * a.height);
  rows.push({ id: ref.id, route: ref.route, viewport: ref.viewport, diffPixels: changed, diffRatio: +ratio.toFixed(4), pass: ratio <= 0.05, diffImage: path, refScroll: ref.actualScrollPx ?? ref.requestedScrollPx, localScroll: loc.actualScrollPx });
}

writeFileSync(OUT + '/compare-report.json', JSON.stringify({ generatedAt: new Date().toISOString(), rows }, null, 2));
const failing = rows.filter((r) => r.pass !== true);
console.log(JSON.stringify({ compared: rows.length, passing: rows.filter((r) => r.pass).length, failing: failing.map((f) => ({ id: f.id, why: f.status ?? f.diffRatio, refScroll: f.refScroll, localScroll: f.localScroll })) }, null, 2));
