import { chromium } from '@playwright/test';
import { PNG } from 'pngjs';
import { readFileSync, copyFileSync } from 'node:fs';

const file = process.argv[2] ?? 'evidence/local/V01-webgl-fixed.png';
const png = PNG.sync.read(readFileSync(file));
const at = (x, y) => { const i = (png.width * y + x) << 2; return [png.data[i], png.data[i + 1], png.data[i + 2], png.data[i + 3]]; };
console.log(`${file}: ${png.width}x${png.height}`);

/* The hero canvas region only (DOM text excluded by sampling inside card quads). */
const stats = (name, x0, y0, x1, y1) => {
  let exact255 = 0, exact0 = 0, n = 0, maxL = 0, minL = 255;
  const hist = new Map();
  for (let y = y0; y < y1; y += 2) for (let x = x0; x < x1; x += 2) {
    const [r, g, b] = at(x, y);
    const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    n++; maxL = Math.max(maxL, lum); minL = Math.min(minL, lum);
    if (r === 255 && g === 255 && b === 255) exact255++;
    if (r === 0 && g === 0 && b === 0) exact0++;
    hist.set(`${r},${g},${b}`, (hist.get(`${r},${g},${b}`) ?? 0) + 1);
  }
  const top = [...hist.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k, v]) => `${k}(${(v / n * 100).toFixed(1)}%)`);
  console.log(`  ${name.padEnd(26)} n=${n} pureWhite=${(exact255 / n * 100).toFixed(2)}% pureBlack=${(exact0 / n * 100).toFixed(2)}% lumRange=[${minL.toFixed(0)},${maxL.toFixed(0)}] top=[${top.join(' ')}]`);
};
stats('hero canvas region', 300, 90, 1140, 830);
stats('near card #1 (Maria)', 560, 400, 860, 700);
stats('near card #2 (Venus)', 820, 250, 1060, 470);

/* Compare against the source artwork: the same white text pixel in Card-2.png. */
const src = PNG.sync.read(readFileSync('public/assets/cards/Card-2.png'));
const srcHist = new Map();
for (let y = 0; y < src.height; y += 7) for (let x = 0; x < src.width; x += 7) {
  const i = (src.width * y + x) << 2;
  const k = `${src.data[i]},${src.data[i + 1]},${src.data[i + 2]}`;
  srcHist.set(k, (srcHist.get(k) ?? 0) + 1);
}
const srcTop = [...srcHist.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k, v]) => `${k}(${(v / [...srcHist.values()].reduce((s, v) => s + v, 0) * 100).toFixed(1)}%)`);
console.log('  source Card-2.png dominant colours:', srcTop.join(' '));

/* Prove the render is not colour-shifted: sample the canvas pixels that correspond to
   the artwork's pure-white "Support Me" button and its pure-black background. */
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1, reducedMotion: 'no-preference' });
const page = await ctx.newPage();
await page.goto('http://127.0.0.1:5175/', { waitUntil: 'load' });
await page.waitForTimeout(2200);
const shot = 'src/testing/_colour_live.png';
await page.screenshot({ path: shot });
copyFileSync(shot, shot);
const live = PNG.sync.read(readFileSync(shot));
const lat = (x, y) => { const i = (live.width * y + x) << 2; return [live.data[i], live.data[i + 1], live.data[i + 2]]; };
let whites = [], blacks = [];
for (let y = 90; y < 830; y++) for (let x = 300; x < 1140; x++) {
  const [r, g, b] = lat(x, y);
  if (r > 250 && g > 250 && b > 250) whites.push([x, y]);
  if (r < 4 && g < 4 && b < 4) blacks.push([x, y]);
}
console.log(`  live hero canvas: ${whites.length} pixels at >=250 white, ${blacks.length} pixels at <=3 black`);
console.log(`  brightest sample rgb(${lat(...whites[Math.floor(whites.length / 2)] ?? [0, 0]).join(',')}) / darkest rgb(${lat(...blacks[Math.floor(blacks.length / 2)] ?? [0, 0]).join(',')})`);
await browser.close();
