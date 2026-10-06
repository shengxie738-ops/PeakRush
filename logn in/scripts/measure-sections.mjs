import { chromium } from '@playwright/test';

/**
 * Measure section geometry on any origin.
 *
 * The reference's home page is not a stack of viewport-height sections: each `section` is
 * 1544px tall while its successor starts only 772px lower, so every section is pinned for one
 * extra viewport of scroll. If the clone's heights or tops differ, scroll-driven scenes land on
 * the wrong frame at every checkpoint and a pixel diff reports "wrong content" when the real
 * defect is geometry. This prints tops/heights/advances so the two can be lined up numerically.
 *
 * Usage: node scripts/measure-sections.mjs <url> [scrollContainerSelector]
 */
const url = process.argv[2];
const CONTAINER = process.argv[3] ?? '.scrollable__area';
if (!url) {
  console.error('usage: node scripts/measure-sections.mjs <url> [scrollContainerSelector]');
  process.exit(2);
}
if (/follow\.art/i.test(url)) {
  console.error('REFUSED: this script drives a real browser at a live site. Reference geometry comes');
  console.error('from the in-app Browser probe; this tool is for the LOCAL clone only.');
  process.exit(2);
}
if (!/^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?\//.test(url)) {
  console.error('REFUSED: not a loopback origin: ' + url);
  process.exit(2);
}

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1376, height: 772 }, deviceScaleFactor: 1.5 });
const page = await context.newPage();
await page.goto(url, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(1500);

const data = await page.evaluate((sel) => {
  const sc = document.querySelector(sel) ?? document.scrollingElement;
  const base = sc.getBoundingClientRect().top;
  const secs = [...document.querySelectorAll('section')];
  const rows = secs.map((s) => {
    const r = s.getBoundingClientRect();
    return {
      key: s.getAttribute('data-section-id') || s.id || String(s.className).split(' ')[0].slice(0, 30),
      top: Math.round(r.top - base + sc.scrollTop),
      h: Math.round(r.height),
    };
  });
  rows.sort((a, b) => a.top - b.top);
  const adv = rows.slice(1).map((r, i) => r.top - rows[i].top);
  return { scrollHeight: sc.scrollHeight, clientHeight: sc.clientHeight, rows, adv };
}, CONTAINER);

console.log(`container=${CONTAINER} scrollHeight=${data.scrollHeight} clientHeight=${data.clientHeight} sections=${data.rows.length}`);
console.log('key                        top     height   advance');
data.rows.forEach((r, i) => {
  const a = i === 0 ? String(r.top) : String(r.top - data.rows[i - 1].top);
  console.log(String(r.key).padEnd(26), String(r.top).padStart(6), String(r.h).padStart(8), a.padStart(9));
});
console.log('advance sequence: ' + data.adv.join(', '));

await context.close();
await browser.close();
