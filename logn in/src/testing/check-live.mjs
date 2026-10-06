import { chromium } from '@playwright/test';
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1, reducedMotion: 'no-preference' });
const page = await ctx.newPage();
const logs = [];
page.on('console', (m) => logs.push(`[${m.type()}] ${m.text().slice(0,240)}`));
page.on('pageerror', (e) => logs.push(`[pageerror] ${String(e.message).slice(0,240)}`));
await page.goto('http://127.0.0.1:5175/', { waitUntil: 'load' });
await page.waitForTimeout(3000);
const info = await page.evaluate(() => ({
  canvases: document.querySelectorAll('canvas').length,
  live: document.querySelectorAll('[data-webgl="live"]').length,
  attrs: Array.from(document.querySelectorAll('[data-webgl]')).map(e => `${e.className.split(' ')[0]}=${e.getAttribute('data-webgl')}`),
  bufferSizes: Array.from(document.querySelectorAll('canvas')).map(c => `${c.width}x${c.height}`),
  state: (() => { try { return null; } catch { return null; } })(),
}));
console.log(JSON.stringify(info, null, 2));
console.log('--- console ---'); console.log(logs.join('\n'));
await browser.close();
