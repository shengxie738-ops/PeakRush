import { chromium } from '@playwright/test';
const b = await chromium.launch();
const c = await b.newContext({ viewport: { width: 1440, height: 900 } });
const p = await c.newPage();
await p.goto('http://127.0.0.1:5175/', { waitUntil: 'networkidle' });
await p.evaluate(() => document.fonts.ready);
await p.waitForTimeout(1000);
const r = await p.evaluate(() => {
  const out = {};
  const hit = [];
  for (const [x, y] of [[700, 500], [200, 600], [1200, 400], [720, 300]]) {
    const els = document.elementsFromPoint(x, y);
    hit.push({
      pt: [x, y],
      chain: els.slice(0, 8).map((e) => {
        const cs = getComputedStyle(e);
        return e.tagName + '.' + (e.getAttribute('class') || '') + ' bg=' + cs.backgroundColor + ' rect=' + JSON.stringify(e.getBoundingClientRect().toJSON());
      }),
    });
  }
  out.hit = hit;
  const big = [];
  for (const e of document.querySelectorAll('body *')) {
    const b = e.getBoundingClientRect();
    if (b.width * b.height > 400000) {
      const cs = getComputedStyle(e);
      big.push({ el: e.tagName + '.' + (e.getAttribute('class') || ''), w: Math.round(b.width), h: Math.round(b.height), x: Math.round(b.x), y: Math.round(b.y), bg: cs.backgroundColor, transform: cs.transform, pos: cs.position });
    }
  }
  out.big = big.slice(0, 40);
  out.cssFiles = [...document.querySelectorAll('link[rel=stylesheet]')].map((l) => l.getAttribute('href'));
  out.styleTags = [...document.querySelectorAll('style')].length;
  return out;
});
console.log(JSON.stringify(r, null, 1));
await b.close();
