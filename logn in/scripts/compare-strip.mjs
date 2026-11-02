import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { PNG } from 'pngjs';

/**
 * Side-by-side reference | clone | diff strip for a set of checkpoint ids.
 *
 * Reading three full-size PNGs per checkpoint to diagnose a mismatch costs more attention than
 * the whole rest of a QA round; one stacked strip per checkpoint answers "is this a colour,
 * a layout, or a missing layer?" immediately. Columns are labelled by position: left reference,
 * middle clone, right pixelmatch mask.
 *
 * Usage: node scripts/compare-strip.mjs <ID,ID,...> <outPng> [divisor]
 */
const ids = (process.argv[2] ?? '').split(',').filter(Boolean);
const out = process.argv[3];
const div = Number(process.argv[4] ?? 3);
if (!ids.length || !out) {
  console.error('usage: node scripts/compare-strip.mjs <ID,ID,...> <outPng> [divisor]');
  process.exit(2);
}

const REF_DIR = 'evidence/reference/captured';
const FREEZE = `${REF_DIR}/2026-10-01`;
const LOC = 'evidence/local';
const DIFF = 'evidence/diffs';

const refPath = (id) => [join(FREEZE, `${id}-_@inapp.png`), join(FREEZE, `${id}-_about@inapp.png`)].find(existsSync)
  ?? (existsSync(`${REF_DIR}/${id}-_@primary.png`) ? `${REF_DIR}/${id}-_@primary.png` : null);

/** Find any `<id>-*.png` in a directory, since route slugs are baked into the filename. */
const findByPrefix = (dir, id) => {
  if (!existsSync(dir)) return null;
  const f = readdirSync(dir).find((n) => n.startsWith(`${id}-`) && n.endsWith('.png'));
  return f ? join(dir, f) : null;
};

const load = (p) => (p && existsSync(p) ? PNG.sync.read(readFileSync(p)) : null);

const cells = [];
for (const id of ids) {
  const a = load(refPath(id)) ?? load(findByPrefix(FREEZE, id));
  const b = load(findByPrefix(LOC, id));
  const c = load(`${DIFF}/${id}-diff.png`);
  if (!a) { console.log(`${id}: no reference frame`); continue; }
  cells.push({ id, a, b, c });
}
if (!cells.length) { console.error('nothing to compose'); process.exit(1); }

const w = Math.round(cells[0].a.width / div);
const h = Math.round(cells[0].a.height / div);
const gap = 6;
const sheet = new PNG({ width: w * 3 + gap * 4, height: (h + gap) * cells.length + gap });
for (let i = 0; i < sheet.data.length; i += 4) { sheet.data[i] = 30; sheet.data[i + 1] = 30; sheet.data[i + 2] = 30; sheet.data[i + 3] = 255; }

const blit = (src, ox, oy) => {
  if (!src) return;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const sx = Math.floor(x * src.width / w), sy = Math.floor(y * src.height / h);
      const si = (src.width * sy + sx) << 2, di = (sheet.width * (oy + y) + (ox + x)) << 2;
      sheet.data[di] = src.data[si]; sheet.data[di + 1] = src.data[si + 1];
      sheet.data[di + 2] = src.data[si + 2]; sheet.data[di + 3] = 255;
    }
  }
};

let row = 0;
for (const c of cells) {
  const oy = gap + row * (h + gap);
  blit(c.a, gap, oy);
  blit(c.b, gap * 2 + w, oy);
  blit(c.c, gap * 3 + w * 2, oy);
  row++;
}

writeFileSync(out, PNG.sync.write(sheet));
console.log(`strip ${out}: ${cells.length} rows, columns = reference | clone | diff, ${sheet.width}x${sheet.height}`);
for (const c of cells) console.log(`  ${c.id}: ref=${c.a ? 'yes' : 'NO'} clone=${c.b ? 'yes' : 'NO'} diff=${c.c ? 'yes' : 'NO'}`);
