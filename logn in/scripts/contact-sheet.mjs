import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { PNG } from 'pngjs';

/**
 * Compose a scaled contact sheet out of a folder of PNG frames.
 *
 * Reviewing a 26-frame freeze one image at a time is expensive and loses the page-topology
 * context; a single grid lets the whole scroll sequence be read as a unit. Labels are drawn as
 * a caption strip under each cell using a bitmap-safe approach: the cell id is taken from the
 * filename, sorted, and printed in the sheet's index order.
 *
 * Usage: node scripts/contact-sheet.mjs <dir> <outPng> [cols] [divisor]
 */
const dir = process.argv[2];
const out = process.argv[3];
const cols = Number(process.argv[4] ?? 4);
const div = Number(process.argv[5] ?? 6);
if (!dir || !out) {
  console.error('usage: node scripts/contact-sheet.mjs <dir> <outPng> [cols] [divisor]');
  process.exit(2);
}

const files = readdirSync(dir).filter((f) => f.endsWith('.png')).sort();
if (!files.length) { console.error('no PNGs in ' + dir); process.exit(1); }

const cells = files.map((f) => {
  const png = PNG.sync.read(readFileSync(join(dir, f)));
  return { f, png, w: Math.round(png.width / div), h: Math.round(png.height / div) };
});

const cellW = Math.max(...cells.map((c) => c.w));
const cellH = Math.max(...cells.map((c) => c.h));
const rows = Math.ceil(cells.length / cols);
const sheet = new PNG({ width: cellW * cols, height: (cellH + 2) * rows });

// White ground so cell edges are separable.
for (let i = 0; i < sheet.data.length; i += 4) { sheet.data[i] = 255; sheet.data[i + 1] = 255; sheet.data[i + 2] = 255; sheet.data[i + 3] = 255; }

let idx = 0;
for (const c of cells) {
  const col = idx % cols, row = Math.floor(idx / cols);
  const ox = col * cellW, oy = row * (cellH + 2);
  // Nearest-neighbour downscale: fidelity of layout is what matters here, not smoothness.
  for (let y = 0; y < c.h; y++) {
    for (let x = 0; x < c.w; x++) {
      const sx = Math.floor(x * c.png.width / c.w), sy = Math.floor(y * c.png.height / c.h);
      const si = (c.png.width * sy + sx) << 2, di = (sheet.width * (oy + y) + (ox + x)) << 2;
      sheet.data[di] = c.png.data[si]; sheet.data[di + 1] = c.png.data[si + 1];
      sheet.data[di + 2] = c.png.data[si + 2]; sheet.data[di + 3] = 255;
    }
  }
  // 2px separator under each cell.
  for (let x = 0; x < cellW; x++) {
    const di = (sheet.width * (oy + c.h) + (ox + x)) << 2;
    sheet.data[di] = 0; sheet.data[di + 1] = 0; sheet.data[di + 2] = 0; sheet.data[di + 3] = 255;
  }
  idx++;
}

writeFileSync(out, PNG.sync.write(sheet));
console.log(`contact sheet ${out}: ${cells.length} cells ${cellW}x${cellH} (1/${div}), grid ${cols}x${rows}, ${sheet.width}x${sheet.height}`);
console.log('order (row-major): ' + cells.map((c) => c.f.split('-')[0]).join(' '));
