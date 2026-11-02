import { chromium } from '@playwright/test';
const out = process.argv[2] ?? 'evidence/local/_probe.png';
const scroll = Number(process.argv[3] ?? 0);
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1, reducedMotion: 'no-preference' });
const page = await ctx.newPage();
await page.goto('http://127.0.0.1:5175/', { waitUntil: 'load' });
await page.evaluate(() => document.fonts.ready);
await page.waitForTimeout(1500);
if (scroll > 0) {
  await page.evaluate((y) => { const el = document.querySelector('.scrollable__area'); if (el) el.scrollTop = y; }, scroll);
  await page.waitForTimeout(1200);
}
await page.screenshot({ path: out });
console.log('wrote', out, 'live=', await page.evaluate(() => document.querySelectorAll('[data-webgl="live"]').length));
await browser.close();
