/**
 * capture.mjs — shared capture engine for the evidence loop.
 *
 * Reference and local captures stay physically separate (capture-reference.mjs /
 * capture-local.mjs are the only entry points, and each hard-codes which origin it
 * may talk to). Scrolling is done with real wheel input because BOTH the reference
 * and this clone scroll inside `.scrollable__area` under Lenis 1.3.3, and assigning
 * scrollTop directly is reverted by Lenis on its next frame (measured in T00).
 */
import { mkdirSync, writeFileSync, existsSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { chromium } from '@playwright/test';

export const VIEWPORTS = {
  primary: { width: 1440, height: 900, deviceScaleFactor: 1 },
  wide: { width: 1920, height: 1080, deviceScaleFactor: 1 },
  narrow: { width: 1366, height: 768, deviceScaleFactor: 1 },
  retina: { width: 1440, height: 900, deviceScaleFactor: 2 },
  /** The Qoder in-app Browser surface: the ONLY viewport at which reference pixels are
   *  obtainable (Cloudflare blocks automated browsers, and the panel cannot be resized).
   *  Clone captures must match it for compare:reference to be an apples-to-apples diff. */
  inapp: { width: 1376, height: 772, deviceScaleFactor: 1.5 },
};

const CONTAINER = '.scrollable__area';

async function scrollToSelector(page, targetPx) {
  let current = await page.evaluate((sel) => document.querySelector(sel)?.scrollTop ?? 0, CONTAINER);
  let guard = 0;
  while (Math.abs(current - targetPx) > 6 && guard++ < 60) {
    const delta = targetPx - current;
    await page.mouse.wheel(0, Math.abs(delta) > 900 ? Math.sign(delta) * 900 : delta);
    await page.waitForTimeout(140);
    current = await page.evaluate((sel) => document.querySelector(sel)?.scrollTop ?? 0, CONTAINER);
  }
  await page.waitForTimeout(420);
  return current;
}

export async function capture({ baseUrl, outDir, checkpoints, viewports = ['primary'], target, only }) {
  if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });
  const launchOptions = {};
  if (process.env.BROWSER_CHANNEL) launchOptions.channel = process.env.BROWSER_CHANNEL;
  if (process.env.HEADED === 'yes') launchOptions.headless = false;
  const browser = await chromium.launch(launchOptions);
  const contextOptions = { viewport: null, locale: 'en', timezoneId: 'Asia/Shanghai', reducedMotion: 'no-preference' };
  if (process.env.USER_AGENT) contextOptions.userAgent = process.env.USER_AGENT;
  const records = [];
  for (const vpName of viewports) {
    const viewport = VIEWPORTS[vpName];
    const context = await browser.newContext({ ...contextOptions, viewport, deviceScaleFactor: viewport.deviceScaleFactor });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push('PAGEERROR ' + String(e.message).slice(0, 200)));
    page.on('console', (m) => {
      if (m.type() === 'error') errors.push('CONSOLE ' + m.text().slice(0, 200));
    });
    page.on('response', (r) => {
      if (r.status() >= 400) errors.push(`HTTP ${r.status()} ${r.url().replace(/^https?:\/\/[^/]+/, '').slice(0, 120)}`);
    });
    for (const cp of checkpoints) {
      if (only && !only.includes(cp.id)) continue;
      await page.goto(baseUrl + cp.route, { waitUntil: 'domcontentloaded' });
      await page.evaluate(() => document.fonts.ready);
      await page.waitForTimeout(700);
      const applied = cp.scrollPx > 0 ? await scrollToSelector(page, cp.scrollPx) : 0;
      const file = join(outDir, `${cp.id}-${cp.route.replace(/\//g, '_') || '_root'}@${vpName}.png`);
      await page.screenshot({ path: file, fullPage: false });
      const metrics = await page.evaluate((sel) => {
        const el = document.querySelector(sel);
        const main = document.querySelector('main');
        return {
          scrollTop: el ? el.scrollTop : null,
          scrollHeight: el ? el.scrollHeight : null,
          clientHeight: el ? el.clientHeight : null,
          canvases: document.querySelectorAll('canvas').length,
          sections: document.querySelectorAll('section').length,
          liveWebgl: document.querySelectorAll('[data-webgl="live"]').length,
          elements: document.querySelectorAll('body *').length,
          mainChildren: main ? main.children.length : 0,
          textLength: (document.body.innerText || '').length,
          h1: main && main.querySelector('h1') ? main.querySelector('h1').innerText.slice(0, 60) : null,
        };
      }, CONTAINER);
      /* Replaced gate (an earlier revision keyed "blank" off sections===0 &&
         canvases===0 and produced 11 false positives: /about renders 573 elements
         with an <h1> but uses <div> blocks, not <section>). Emptiness is now judged
         on what a blank page actually has: no mounted children and no readable text. */
      const blank = metrics.mainChildren === 0 && metrics.textLength < 40;
      if (blank) errors.unshift(`BLANK: <main> has ${metrics.mainChildren} children and ${metrics.textLength} chars of text — the page did not mount`);
      records.push({
        id: cp.id, route: cp.route, label: cp.label, target, viewport: `${viewport.width}x${viewport.height}@${viewport.deviceScaleFactor}`,
        blank,
        requestedScrollPx: cp.scrollPx, actualScrollPx: applied, file: file.replace(/\\/g, '/'),
        sha256: createHash('sha256').update(new Uint8Array(await import('node:fs').then((m) => m.readFileSync(file)))).digest('hex').slice(0, 16),
        ...metrics, pageErrors: errors.slice(-3), capturedAt: new Date().toISOString(),
      });
      console.log(`${cp.id} ${cp.route} @${vpName} -> scroll ${applied}/${cp.scrollPx}px  canvases=${metrics.canvases} live=${metrics.liveWebgl ?? 0}${errors.length ? ' ERR:' + errors[0] : ''}`);
    }
    await context.close();
  }
  await browser.close();
  /* A filtered run (`ONLY=V21,V22`) must not silently replace the whole report — it only
     holds the checkpoints it captured, so overwriting dropped 26 records to 2 in practice.
     Merge by id+viewport and keep every record this run did not touch. */
  const outFile = join(outDir, 'capture-report.json');
  let merged = records;
  if (only && existsSync(outFile)) {
    const prior = JSON.parse(readFileSync(outFile, 'utf8')).records ?? [];
    const touched = new Set(records.map((r) => `${r.id}|${r.viewport}`));
    merged = [...prior.filter((r) => !touched.has(`${r.id}|${r.viewport}`)), ...records];
    console.log(`merged filtered run into ${outFile}: ${prior.length} prior + ${records.length} new -> ${merged.length} records`);
  }
  writeFileSync(outFile, JSON.stringify({ baseUrl, target, records: merged }, null, 2));
  return merged;
}
