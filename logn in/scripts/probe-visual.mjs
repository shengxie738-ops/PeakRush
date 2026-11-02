import { chromium } from '@playwright/test';

const BASE = process.env.BASE_URL || 'http://127.0.0.1:5175';
const VIEWPORT =
  process.env.VP === 'oracle'
    ? { width: 1376, height: 772, deviceScaleFactor: 1 }
    : { width: 1440, height: 900, deviceScaleFactor: 1 };

const PROBE = () => {
  const cs = (el) => getComputedStyle(el);
  const rect = (el) => {
    const r = el.getBoundingClientRect();
    return [
      Math.round(r.x * 100) / 100,
      Math.round(r.y * 100) / 100,
      Math.round(r.width * 100) / 100,
      Math.round(r.height * 100) / 100,
    ];
  };
  const out = {};
  const root = document.querySelector('.scrollable--root');
  out.root = { rect: rect(root), bg: cs(root).backgroundColor, position: cs(root).position };
  out.body = { bg: cs(document.body).backgroundColor };
  out.htmlFontSize = cs(document.documentElement).fontSize;

  const h1 = document.querySelector('h1');
  out.h1 = h1
    ? { cls: h1.className, rect: rect(h1), fontSize: cs(h1).fontSize, lineHeight: cs(h1).lineHeight, fontWeight: cs(h1).fontWeight, fontFamily: cs(h1).fontFamily, textTransform: cs(h1).textTransform, position: cs(h1).position, text: h1.textContent.trim() }
    : null;

  out.headings = Array.from(document.querySelectorAll('h1,h2')).map((h) => ({
    tag: h.tagName, cls: h.className, rect: rect(h),
    fontSize: cs(h).fontSize, lineHeight: cs(h).lineHeight, transform: cs(h).transform,
    text: (h.textContent || '').trim().slice(0, 32),
  }));

  out.displaySvg = Array.from(document.querySelectorAll('svg.svg-fix, svg[class*=title-icon]')).map((s) => ({
    cls: s.getAttribute('class'), viewBox: s.getAttribute('viewBox'),
    paths: s.querySelectorAll('path').length, rect: rect(s),
    hidden: cs(s).display === 'none',
  }));

  out.navLinks = Array.from(document.querySelectorAll('header.promo-header a.btn')).map((a) => {
    let text = null;
    const tn = Array.from(a.childNodes).find((n) => n.nodeType === 3 && n.textContent.trim());
    if (tn) {
      const r = document.createRange();
      r.selectNodeContents(tn);
      const b = r.getBoundingClientRect();
      text = [Math.round(b.x * 100) / 100, Math.round(b.y * 100) / 100, Math.round(b.width * 100) / 100, Math.round(b.height * 100) / 100];
    }
    return {
      text: (a.textContent || '').trim(), cls: a.className, rect: rect(a), textRect: text,
      fontSize: cs(a).fontSize, lineHeight: cs(a).lineHeight, color: cs(a).color,
    };
  });

  const header = document.querySelector('header');
  out.header = header
    ? { cls: header.className, rect: rect(header), bg: cs(header).backgroundColor, position: cs(header).position, padding: cs(header).padding, zIndex: cs(header).zIndex }
    : null;

  out.brushes = Array.from(
    document.querySelectorAll('.btn__hover-accent, .underline-text-piece__decoration, .intro__title-decoration, .intro__text-icon, [class*=_title-decoration], [class*=_btn-icon], .image-trail__photo, .section-2__media-decoration, .section-4__cards-wrapper-decoration'),
  ).map((s) => {
    const r = s.getBoundingClientRect();
    return { cls: s.getAttribute('class'), tag: s.tagName, rect: [Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)], opacity: cs(s).opacity, display: cs(s).display };
  });

  /* anything painting wider than the section that owns it, ignoring boxes that
     an ancestor already clips (the marquee track is wider on purpose) */
  const clipped = (el, secRect) => {
    let p = el.parentElement;
    while (p && p !== document.body) {
      const ov = cs(p).overflowX;
      if (ov === 'hidden' || ov === 'clip' || ov === 'auto' || ov === 'scroll') {
        const pr = p.getBoundingClientRect();
        if (pr.left >= secRect.left - 2 && pr.right <= secRect.right + 2) return true;
      }
      p = p.parentElement;
    }
    return false;
  };
  out.overflow = [];
  for (const section of document.querySelectorAll('[data-section-id]')) {
    const sr = section.getBoundingClientRect();
    const id = section.getAttribute('data-section-id');
    for (const el of section.querySelectorAll('*')) {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      const wide = r.width > sr.width + 8;
      const outside = r.left < sr.left - 8 || r.right > sr.right + 8;
      if (!wide && !outside) continue;
      if (clipped(el, sr)) continue;
      out.overflow.push({ id, el: el.tagName + '.' + (el.getAttribute('class') || ''), w: Math.round(r.width), secW: Math.round(sr.width) });
    }
  }

  /* the widest painted box anywhere on the page, per section */
  out.sectionMax = Array.from(document.querySelectorAll('[data-section-id]')).map((s) => {
    let max = 0;
    let who = '';
    for (const el of s.querySelectorAll('*')) {
      const r = el.getBoundingClientRect();
      if (r.width > max) { max = r.width; who = el.tagName + '.' + (el.getAttribute('class') || ''); }
    }
    return { id: s.getAttribute('data-section-id'), rect: rect(s), widest: Math.round(max), who };
  });
  return out;
};

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: VIEWPORT, locale: 'en', reducedMotion: 'no-preference' });
const page = await context.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e.message).slice(0, 200)));
page.on('console', (m) => {
  if (m.type() === 'error') errors.push('console: ' + m.text().slice(0, 200));
});
await page.goto(BASE + '/', { waitUntil: 'domcontentloaded', timeout: 20000 });
await page.evaluate(() => document.fonts.ready);
await page.waitForTimeout(1500);
const data = await page.evaluate(PROBE);
console.log(JSON.stringify(data, null, process.env.FLAT ? 0 : 1));
if (errors.length) console.log('--- PAGE ERRORS ---\n' + errors.join('\n'));
if (process.env.SHOT) await page.screenshot({ path: process.env.SHOT });
await browser.close();
