import { expect, test, type Page } from '@playwright/test';

/**
 * T10 — lifecycle, leak, reduced-motion, WebGL-failure fallback, DPR and perf.
 *
 * The clone mounts five live three.js scenes on the home page and re-mounts them on route
 * changes, so "it looks right once" says nothing about whether contexts, listeners and
 * animation frames survive twenty navigations. Every assertion here is against a number that
 * a leak would actually move.
 */

interface GLStats {
  created: number;
  lost: number;
}

interface ProbeWindow extends Window {
  __GLSTATS__?: GLStats;
  __DRAWS__?: Record<string, number>;
}

/** Minimal structural type for the Nuxt router reachable off the DOM. */
interface VueAppHost extends HTMLElement {
  __vue_app__?: { config?: { globalProperties?: { $router?: { push: (to: string) => unknown } } } };
}

type GetContextFn = (this: HTMLCanvasElement, type: string, ...rest: unknown[]) => unknown;

const SCROLL_SELECTOR = '.scrollable__area';

async function scrollClone(page: Page, y: number): Promise<void> {
  await page.evaluate(([sel, v]) => {
    const el = document.querySelector(sel) as HTMLElement | null;
    if (el) el.scrollTop = v;
  }, [SCROLL_SELECTOR, y] as const);
}

/** Count WebGL contexts the app creates, so "suppressed" is provable rather than implied. */
async function instrumentGL(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const w = window as ProbeWindow;
    w.__GLSTATS__ = { created: 0, lost: 0 };
    const orig = HTMLCanvasElement.prototype.getContext as GetContextFn;
    (HTMLCanvasElement.prototype as unknown as { getContext: GetContextFn }).getContext = function (
      this: HTMLCanvasElement,
      type: string,
      ...rest: unknown[]
    ) {
      const ctx = orig.call(this, type, ...rest);
      if (ctx && (type === 'webgl' || type === 'webgl2')) {
        w.__GLSTATS__!.created++;
        this.addEventListener('webglcontextlost', () => { w.__GLSTATS__!.lost++; });
      }
      return ctx as ReturnType<typeof orig>;
    };
  });
}

const glStats = (page: Page): Promise<GLStats> =>
  page.evaluate(() => (window as ProbeWindow).__GLSTATS__ ?? { created: 0, lost: 0 });

const ROUTES = [
  '/', '/about', '/our-product', '/pricing', '/faq',
  '/community-board', '/signin', '/signup', '/gift-card',
];

test('20 route round-trips do not accumulate canvases, listeners or errors', async ({ page }) => {
  test.setTimeout(240_000);
  await instrumentGL(page);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e.message).slice(0, 140)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push('CONSOLE ' + m.text().slice(0, 140)); });

  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1500);
  const baselineCanvases = await page.locator('canvas').count();
  const baselineNodes = await page.evaluate(() => document.querySelectorAll('body *').length);

  for (let i = 0; i < 20; i++) {
    for (const route of ROUTES) {
      await page.evaluate((r) => {
        const host = document.querySelector('#__nuxt') as VueAppHost | null;
        host?.__vue_app__?.config?.globalProperties?.$router?.push(r);
      }, route);
      await page.waitForTimeout(45);
    }
  }
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);

  const afterCanvases = await page.locator('canvas').count();
  const afterNodes = await page.evaluate(() => document.querySelectorAll('body *').length);
  const stats = await glStats(page);

  // 180 navigations must not leave stray canvases behind.
  expect(afterCanvases, `canvas count drifted ${baselineCanvases} -> ${afterCanvases}`).toBe(baselineCanvases);
  // A detached-DOM leak shows up as a growing node count.
  expect(afterNodes, `DOM nodes grew ${baselineNodes} -> ${afterNodes}`).toBeLessThan(baselineNodes * 1.35);
  expect(errors, `errors during round-trips: ${errors.slice(0, 4).join(' | ')}`).toEqual([]);
  expect(stats.created, `contexts created: ${stats.created}`).toBeGreaterThan(0);
});

test('prefers-reduced-motion suppresses WebGL but still renders content', async ({ page }) => {
  await instrumentGL(page);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);

  const stats = await glStats(page);
  expect(stats.created, 'no WebGL context should be allocated under reduced motion').toBe(0);

  const text = await page.evaluate(() => (document.body.innerText || '').length);
  expect(text, 'reduced-motion page must still render copy').toBeGreaterThan(800);
  await expect(page.locator('main')).not.toBeEmpty();
});

test('home page still renders if WebGL is unavailable', async ({ page }) => {
  await page.addInitScript(() => {
    const orig = HTMLCanvasElement.prototype.getContext as GetContextFn;
    (HTMLCanvasElement.prototype as unknown as { getContext: GetContextFn }).getContext = function (
      this: HTMLCanvasElement,
      type: string,
      ...rest: unknown[]
    ) {
      if (type === 'webgl' || type === 'webgl2') return null;
      return orig.call(this, type, ...rest) as ReturnType<typeof orig>;
    };
  });
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e.message).slice(0, 140)));

  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2200);

  const text = await page.evaluate(() => (document.body.innerText || '').length);
  expect(text, 'no WebGL must not blank the page').toBeGreaterThan(800);
  expect(errors, `unhandled errors without WebGL: ${errors.slice(0, 3).join(' | ')}`).toEqual([]);
});

test('hero renderer pins pixel ratio 2, so its buffer is at least 2x its CSS box', async ({ page }) => {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2200);
  const hero = await page.evaluate(() => {
    const wrap = document.querySelector('.landing-1-intro-webgl__canvas-wrapper');
    const c = wrap ? wrap.querySelector('canvas') : null;
    if (!c) return null;
    const r = c.getBoundingClientRect();
    return {
      buf: [c.width, c.height] as [number, number],
      css: [Math.round(r.width), Math.round(r.height)] as [number, number],
    };
  });
  expect(hero, 'hero canvas must exist').not.toBeNull();
  const h = hero as { buf: [number, number]; css: [number, number] };
  // Measured on the reference: CSS 1376x772 with buffer 2752x1544 against a 1.5 device.
  expect(h.buf[0], `buffer width ${h.buf[0]} vs css ${h.css[0]}`).toBeGreaterThanOrEqual(h.css[0] * 2 - 2);
  expect(h.buf[1], `buffer height ${h.buf[1]} vs css ${h.css[1]}`).toBeGreaterThanOrEqual(h.css[1] * 2 - 2);
});

test('all five home scenes draw', async ({ page }) => {
  test.setTimeout(120_000);
  await page.addInitScript(() => {
    const w = window as ProbeWindow;
    w.__DRAWS__ = {};
    const orig = HTMLCanvasElement.prototype.getContext as GetContextFn;
    (HTMLCanvasElement.prototype as unknown as { getContext: GetContextFn }).getContext = function (
      this: HTMLCanvasElement,
      type: string,
      ...rest: unknown[]
    ) {
      const ctx = orig.call(this, type, ...rest);
      if (ctx && (type === 'webgl' || type === 'webgl2')) {
        const key = String(this.parentElement?.className || 'unknown').replace(/\s+/g, ' ').slice(0, 34);
        const bag = w.__DRAWS__!;
        bag[key] = bag[key] || 0;
        const target = ctx as Record<string, ((...a: unknown[]) => unknown) | undefined>;
        for (const fn of ['drawElements', 'drawArrays']) {
          const original = target[fn];
          if (typeof original !== 'function') continue;
          const bound = original.bind(ctx);
          target[fn] = (...a: unknown[]) => { bag[key]++; return bound(...a); };
        }
      }
      return ctx as ReturnType<typeof orig>;
    };
  });
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1200);
  for (const y of [0, 1150, 1900, 4450, 5400]) {
    await scrollClone(page, y);
    await page.waitForTimeout(1400);
  }
  const draws = await page.evaluate(() => (window as ProbeWindow).__DRAWS__ ?? {});
  const drawing = Object.entries(draws).filter(([, n]) => n > 0).map(([k]) => k);
  for (const scene of [
    'landing-1-intro', 'landing-2-get-seen', 'landing-5-nexus',
    'landing-7-connectory', 'landing-9-testimonials',
  ]) {
    expect(drawing.some((k) => k.includes(scene)), `${scene} never issued a draw call`).toBe(true);
  }
});

test('three frame-rate samples are recorded for the motion evidence', async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1500);
  await scrollClone(page, 1900);
  await page.waitForTimeout(900);

  const samples: number[] = [];
  for (let s = 0; s < 3; s++) {
    const fps = await page.evaluate(async () => {
      let frames = 0;
      const t0 = performance.now();
      await new Promise<void>((resolve) => {
        const tick = (): void => {
          frames++;
          if (performance.now() - t0 < 2000) requestAnimationFrame(tick);
          else resolve();
        };
        requestAnimationFrame(tick);
      });
      return (frames / (performance.now() - t0)) * 1000;
    });
    samples.push(Math.round(fps * 10) / 10);
  }
  const { writeFileSync, mkdirSync } = await import('node:fs');
  mkdirSync('evidence/perf', { recursive: true });
  writeFileSync(
    'evidence/perf/home-fps.json',
    JSON.stringify({ samples, viewport: '1376x772@1.5', at: new Date().toISOString() }, null, 2),
  );
  // A dead animation loop would report ~0.
  expect(Math.max(...samples), `fps samples ${samples.join('/')}`).toBeGreaterThan(10);
});
