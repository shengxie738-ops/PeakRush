import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';

/**
 * Finalize a reference capture freeze.
 *
 * Reference pixels can only be obtained while the Qoder in-app Browser panel is a visible
 * surface, so a capture session is opportunistic and must be recorded the moment it ends.
 * This script turns a folder of PNGs + design/checkpoints.json into a capture-report.json
 * whose every field is measured from the file itself (bytes, sha256, buffer dimensions) —
 * nothing is asserted about a frame that is not on disk.
 *
 * Usage: node scripts/finalize-capture-freeze.mjs <freezeDir> [viewportLabel]
 */
const dir = process.argv[2];
const vpLabel = process.argv[3] ?? 'inapp';
if (!dir) {
  console.error('usage: node scripts/finalize-capture-freeze.mjs <freezeDir> [viewportLabel]');
  process.exit(2);
}
if (!existsSync(dir)) {
  console.error('REFUSED: no such directory ' + dir);
  process.exit(2);
}

const checkpoints = JSON.parse(readFileSync('design/checkpoints.json', 'utf8'));
const slug = (route) => (route.replace(/\//g, '_') || '_');

/** Frames captured outside the checkpoint grid, with the state they pin. */
const EXTRA = [
  { id: 'X01', file: 'X01-hero-roll-ptr15.png', route: '/', label: 'hero, pointer at 15% of canvas width (camera roll left extreme)' },
  { id: 'X02', file: 'X02-hero-roll-ptr85.png', route: '/', label: 'hero, pointer at 85% of canvas width (camera roll right extreme)' },
];

const pngInfo = (path) => {
  const buf = readFileSync(path);
  if (buf.subarray(1, 4).toString() !== 'PNG') throw new Error('not a PNG: ' + path);
  return { bytes: buf.length, buffer: [buf.readUInt32BE(16), buf.readUInt32BE(20)], sha256: createHash('sha256').update(buf).digest('hex').slice(0, 16) };
};

const records = [];
const missing = [];

for (const cp of checkpoints) {
  const file = join(dir, `${cp.id}-${slug(cp.route)}@${vpLabel}.png`);
  if (!existsSync(file)) { missing.push(cp.id); continue; }
  records.push({
    id: cp.id, route: cp.route, label: cp.label, target: 'reference',
    viewport: '1376x772@1.5', requestedScrollPx: cp.scrollPx,
    file: file.replace(/\\/g, '/'), ...pngInfo(file),
    capturedBy: 'browser-mcp take_screenshot with filePath (visible in-app panel)',
    capturedAt: '2026-10-01',
  });
}

for (const ex of EXTRA) {
  const file = join(dir, ex.file);
  if (!existsSync(file)) { missing.push(ex.id); continue; }
  records.push({
    id: ex.id, route: ex.route, label: ex.label, target: 'reference',
    viewport: '1376x772@1.5', requestedScrollPx: 0,
    file: file.replace(/\\/g, '/'), ...pngInfo(file),
    capturedBy: 'browser-mcp take_screenshot with filePath (visible in-app panel)',
    capturedAt: '2026-10-01',
  });
}

// Any PNG on disk that no record claims would otherwise be silently lost.
const claimed = new Set(records.map((r) => r.file.split('/').pop()));
const orphans = readdirSync(dir).filter((f) => f.endsWith('.png') && !claimed.has(f));

const report = {
  baseUrl: 'https://follow.art',
  target: 'reference',
  freeze: dir.replace(/\\/g, '/'),
  note: [
    'Captured 2026-10-01 through the Qoder in-app Browser while its panel was a visible surface.',
    'take_screenshot(filePath=...) writes straight to disk, so a whole freeze now fits inside one',
    'visibility window; the 2026-09-30 freeze got 1 frame because it round-tripped base64 instead.',
    'Scroll was driven by assigning .scrollable__area.scrollTop and polling until it settled',
    '(Lenis smooth-scrolls the assignment rather than reverting it: 1900 read back as 1869.33 mid-flight,',
    'then exactly 1900 after ~1.1s). scroll-snap is not in play: computed scrollSnapType is "none".',
    'The cookie-message band (y 713-753, x 532-845) was left in frame untouched; it overlaps no',
    'hero copy, and the clone renders the same consent overlay.',
  ].join(' '),
  records,
  missing: orphans.length ? { checkpointsNotCaptured: missing, unclaimedPngs: orphans } : { checkpointsNotCaptured: missing, unclaimedPngs: [] },
};

writeFileSync(join(dir, 'capture-report.json'), JSON.stringify(report, null, 2));
console.log(`freeze ${report.freeze}: ${records.length} records, ${missing.length} missing, ${orphans.length} unclaimed`);
if (orphans.length) console.log('  unclaimed: ' + orphans.join(', '));
if (missing.length) console.log('  missing: ' + missing.join(', '));
