import { expect, test, type Page } from '@playwright/test';

/**
 * T09 — network isolation.
 *
 * This clone reproduces a live commercial site for local study only. Every one of its
 * 107 assets is registered `rights: permission-required`, so the standing rule is that the
 * running app must never talk to anyone but itself: no analytics, no captcha, no
 * maps/Places SDK, no OAuth redirect, and above all no request to follow.art. The
 * reference's own runtime config carries DataDog / reCAPTCHA / GTM / Facebook keys; none
 * of them were copied, and this suite is the guard that keeps it that way.
 *
 * The assertions here are deliberately about *traffic*, not markup, so they stay valid as
 * the pages are rebuilt to their measured layouts.
 */

const LOOPBACK = /^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?\//;
const WRITE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

const ROUTES = [
  '/', '/about', '/our-product', '/pricing', '/faq', '/community-board',
  '/signin', '/signup', '/gift-card', '/terms-and-conditions', '/privacy-policy',
  '/cookies-policy', '/this-route-does-not-exist',
];

interface Captured {
  offOrigin: string[];
  writes: string[];
  thirdPartyHosts: Set<string>;
  total: number;
}

/** Record every request the page makes, then fail loudly on anything that leaves loopback. */
function captureRequests(page: Page): Captured {
  const c: Captured = { offOrigin: [], writes: [], thirdPartyHosts: new Set(), total: 0 };
  page.on('request', (req) => {
    c.total++;
    const url = req.url();
    if (url.startsWith('data:') || url.startsWith('blob:') || url.startsWith('about:')) return;
    if (!LOOPBACK.test(url)) {
      c.offOrigin.push(`${req.method()} ${url.slice(0, 160)}`);
      try { c.thirdPartyHosts.add(new URL(url).host); } catch { /* unparseable, already recorded */ }
    }
    if (WRITE_METHODS.has(req.method())) c.writes.push(`${req.method()} ${url.slice(0, 160)}`);
  });
  return c;
}

function assertIsolated(c: Captured): void {
  expect(c.offOrigin, `requests left the loopback origin: ${c.offOrigin.join(' | ')}`).toEqual([]);
  expect(c.writes, `a write-method request was issued: ${c.writes.join(' | ')}`).toEqual([]);
}

test('every route loads without a single non-loopback request', async ({ page }) => {
  for (const route of ROUTES) {
    const c = captureRequests(page);
    await page.goto(route, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(900);
    assertIsolated(c);
    // A route that rendered nothing would trivially pass the isolation check.
    await expect(page.locator('main')).not.toBeEmpty();
  }
});

test('scrolling the whole home page triggers no egress', async ({ page }) => {
  const c = captureRequests(page);
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1200);
  const max = await page.evaluate(() => {
    const sc = document.querySelector('.scrollable__area');
    return sc ? sc.scrollHeight - sc.clientHeight : 0;
  });
  expect(max, 'home page should be scrollable').toBeGreaterThan(5000);
  for (let y = 0; y <= max; y += 600) {
    await page.evaluate((v) => { (document.querySelector('.scrollable__area') as HTMLElement).scrollTop = v; }, y);
    await page.waitForTimeout(120);
  }
  await page.waitForTimeout(800);
  assertIsolated(c);
});

test('the WebGL home page runs without egress and without console errors', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 160)); });
  page.on('pageerror', (e) => errors.push(String(e.message).slice(0, 160)));
  const c = captureRequests(page);
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1500);
  // Drive the scenes into range so their render loops actually run.
  await page.evaluate(() => { (document.querySelector('.scrollable__area') as HTMLElement).scrollTop = 4900; });
  await page.waitForTimeout(1500);
  assertIsolated(c);
  expect(errors, `console errors on home: ${errors.join(' | ')}`).toEqual([]);
});

test('auth forms never submit over the wire', async ({ page }) => {
  for (const route of ['/signin', '/signup'] as const) {
    const c = captureRequests(page);
    await page.goto(route, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(900);

    const email = page.locator('input[type="email"]').first();
    const password = page.locator('input[type="password"]').first();
    if (await email.count()) await email.fill('someone@example.test');
    if (await password.count()) await password.fill('not-a-real-password');

    const consent = page.locator('input[type="checkbox"]').first();
    if (await consent.count()) await consent.check({ force: true }).catch(() => undefined);

    const submit = page.locator('button[type="submit"], .btn--primary').first();
    if (await submit.count()) await submit.click({ force: true }).catch(() => undefined);
    await page.waitForTimeout(1000);

    assertIsolated(c);
    // Nothing may persist a credential either.
    const stored = await page.evaluate(() => {
      const bad: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i) ?? '';
        if (/pass|token|secret|credential|auth|email/i.test(k)) bad.push('localStorage:' + k);
      }
      for (let i = 0; i < sessionStorage.length; i++) {
        const k = sessionStorage.key(i) ?? '';
        if (/pass|token|secret|credential|auth|email/i.test(k)) bad.push('sessionStorage:' + k);
      }
      if (/pass|token|secret|credential|auth/i.test(document.cookie)) bad.push('cookie:' + document.cookie.slice(0, 80));
      return bad;
    });
    expect(stored, `credentials persisted on ${route}: ${stored.join(', ')}`).toEqual([]);
  }
});

/**
 * Click a control and tolerate it navigating away. The request listener stays attached to
 * the page across navigations, so egress is still recorded even when a click moves us on.
 */
async function clickTolerantly(page: Page, locator: ReturnType<Page['locator']>, index: number): Promise<void> {
  try {
    await locator.nth(index).click({ force: true, noWaitAfter: true, timeout: 1500 });
  } catch {
    // Covered/hidden/animating controls are not egress findings; ignore.
  }
  try {
    await page.waitForLoadState('domcontentloaded', { timeout: 2000 });
  } catch {
    // A still-running client-side transition is fine here.
  }
}

test('pricing cycle and gift-card controls cause no egress', async ({ page }) => {
  const c = captureRequests(page);

  await page.goto('/pricing', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(900);
  const radioCount = await page.locator('input[type="radio"]').count();
  for (let i = 0; i < radioCount; i++) {
    await page.locator('input[type="radio"]').nth(i).check({ force: true }).catch(() => undefined);
    await page.waitForTimeout(80);
  }
  // Only real buttons are clicked. The plan CTAs are router links; clicking one navigates
  // away mid-loop, which is a harness problem rather than an egress finding.
  const planBtnCount = await page.locator('.plans-difference button').count();
  for (let i = 0; i < planBtnCount; i++) await clickTolerantly(page, page.locator('.plans-difference button'), i);
  assertIsolated(c);

  // The CTAs are instead verified by destination: they must be relative or loopback.
  const hrefs = await page.locator('.plans-difference a').evaluateAll((els) =>
    els.map((e) => (e as HTMLAnchorElement).getAttribute('href') ?? ''),
  );
  for (const href of hrefs) {
    expect(href, 'absolute external CTA target').not.toMatch(/^https?:\/\//);
  }

  await page.goto('/gift-card', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(900);
  const btnCount = await page.locator('button').count();
  for (let i = 0; i < btnCount; i++) await clickTolerantly(page, page.locator('button'), i);
  assertIsolated(c);
});

test('no reference-site secret string appears anywhere in the served bundle', async ({ request }) => {
  // The reference's runtime config embeds third-party keys. None may be carried over.
  const markers = ['datadog', 'DD_API_KEY', 'recaptcha', 'google_tag_manager', 'GTM-', 'connect.facebook', 'clarity'];
  const html = await (await request.get('/')).text();
  const scripts = [...html.matchAll(/src="([^"]+\.js)"/g)].map((m) => m[1]);
  const bodies = [html];
  for (const src of scripts.slice(0, 40)) {
    try { bodies.push(await (await request.get(src)).text()); } catch { /* missing chunk is not a leak */ }
  }
  const hay = bodies.join('\n').toLowerCase();
  for (const m of markers) {
    expect(hay.includes(m.toLowerCase()), `bundle contains reference marker "${m}"`).toBe(false);
  }
});
