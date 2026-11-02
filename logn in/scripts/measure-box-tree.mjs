import { chromium } from '@playwright/test';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

/**
 * Dump the box tree under a selector with the SAME walker used by the in-app Browser reference
 * probe, so reference and clone numbers are directly diffable.
 *
 * The reference side cannot be measured with this file (Playwright is refused for follow.art);
 * it is run through mcp browser-use evaluate_script with the identical body, exported here as
 * WALKER so the two can never drift apart.
 *
 * Usage: node scripts/measure-box-tree.mjs <loopback-url> <selector> <out.json>
 */
const PROPS = ['display','flexDirection','alignItems','height','minHeight','marginTop','marginBottom',
  'paddingTop','paddingBottom','fontSize','lineHeight','position','gap','order','boxSizing',
  'borderTopWidth','borderBottomWidth','textIndent','whiteSpace','maxWidth'];

export const WALKER = /* js */ `(selector) => {
  const props = ${JSON.stringify(PROPS)};
  const sec = document.querySelector(selector);
  if (!sec) return JSON.stringify({ error: 'no element: ' + selector });
  // Entrance animations are keyframe transforms on the measured boxes; in a surface that does not
  // paint they freeze at their start value, so every rect would be the pre-animation one.
  document.getAnimations().forEach((a) => { try { a.finish(); } catch (e) {} });
  const base = sec.getBoundingClientRect();
  const box = (el) => {
    const r = el.getBoundingClientRect();
    return [Math.round((r.left - base.left) * 100) / 100, Math.round((r.top - base.top) * 100) / 100,
      Math.round(r.width * 100) / 100, Math.round(r.height * 100) / 100];
  };
  const out = [];
  (function walk(el, depth) {
    if (depth > 5) return;
    for (const c of el.children) {
      const cs = getComputedStyle(c);
      const st = {};
      for (const p of props) {
        const v = cs[p];
        if (v && v !== 'normal' && v !== 'auto' && v !== '0px' && v !== 'none' && v !== 'row' && v !== 'stretch') st[p] = v;
      }
      const rec = { depth, tag: c.tagName.toLowerCase(),
        cls: (typeof c.className === 'string' ? c.className : '').slice(0, 120),
        box: box(c), h: Math.round(c.getBoundingClientRect().height * 100) / 100, s: st };
      const txt = c.childNodes.length === 1 && c.childNodes[0].nodeType === 3 ? c.textContent.trim().slice(0, 60) : null;
      if (txt) rec.text = txt;
      out.push(rec);
      walk(c, depth + 1);
    }
  })(sec, 0);
  return JSON.stringify({ selector, secBox: box(sec), count: out.length, nodes: out });
}`;

const [url, selector, outPath] = process.argv.slice(2);
if (!url || !selector || !outPath) {
  console.error('usage: node scripts/measure-box-tree.mjs <loopback-url> <selector> <out.json>');
  process.exit(2);
}
if (/follow\.art/i.test(url)) {
  console.error('REFUSED: reference measurement goes through the in-app Browser probe, never Playwright.');
  process.exit(2);
}
if (!/^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?\//.test(url)) {
  console.error('REFUSED: not a loopback origin: ' + url);
  process.exit(2);
}

const walker = new Function('return ' + WALKER)();
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1376, height: 772 }, deviceScaleFactor: 1.5 });
await page.goto(url, { waitUntil: 'networkidle' });
const json = await page.evaluate(new Function('s', `return (${WALKER})(s)`), selector);
mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, json);
const parsed = JSON.parse(json);
console.log(`${url} ${selector} -> ${outPath}  nodes=${parsed.count} secBox=${JSON.stringify(parsed.secBox)}`);
void walker;
await browser.close();
