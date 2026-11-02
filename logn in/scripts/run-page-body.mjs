import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { chromium } from '@playwright/test';

/**
 * Run a page-side probe body against a LOOPBACK clone and save its JSON result.
 *
 * The same body file is pasted into the in-app Browser `evaluate_script` for the reference side
 * (Playwright is refused there), so reference and clone numbers always come from identical code.
 * Keep each body a single arrow function with no outer backticks.
 *
 * Usage: node scripts/run-page-body.mjs <loopback-url> <body-file> <out.json>
 */
const [url, bodyFile, outPath] = process.argv.slice(2);
if (!url || !bodyFile || !outPath) {
  console.error('usage: node scripts/run-page-body.mjs <loopback-url> <body-file> <out.json>');
  process.exit(2);
}
if (/follow\.art/i.test(url)) {
  console.error('REFUSED: reference probes go through the in-app Browser, never Playwright.');
  process.exit(2);
}
if (!/^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?\//.test(url)) {
  console.error('REFUSED: not a loopback origin: ' + url);
  process.exit(2);
}

const body = readFileSync(resolve(bodyFile), 'utf8');
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1376, height: 772 }, deviceScaleFactor: 1.5 });
await page.goto(url, { waitUntil: 'networkidle' });
// Playwright evaluates a string as an expression: an arrow-function body would just yield the
// function and serialise to undefined, so call it here.
const json = await page.evaluate(`(${body.trim()})()`);
/* `__bodyChars` is stamped on BOTH sides so a reference/clone comparison can prove the two probes
   ran identical text — a divergent body turns measurement error into a fake fidelity delta. */
let outText = typeof json === 'string' ? json : JSON.stringify(json);
try {
  const parsed = JSON.parse(outText);
  if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
    parsed.__bodyChars = body.trim().length;
    outText = JSON.stringify(parsed);
  }
} catch {
  /* a body that returns something other than a JSON object is stored as-is */
}
mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, outText);
console.log(`${url} -> ${outPath} (${outText.length} bytes, bodyChars=${body.trim().length})`);
await browser.close();
