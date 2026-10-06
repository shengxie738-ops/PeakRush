import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright config for the FOLLOW.ART clone.
 *
 * Only the LOCAL clone is ever driven here. The reference site is out of scope by
 * project rule: it is reachable only through the Qoder in-app Browser (Cloudflare
 * challenges Playwright's bundled Chromium and channel:'msedge'), and this suite must
 * never be able to point a request at follow.art. `baseURL` is therefore hard-pinned to
 * loopback and `tests/e2e/network-isolation.spec.ts` asserts that nothing leaves it.
 *
 * The webServer reuses an already-running dev server so this config does not fight the
 * session that keeps one up on 5175.
 */
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: process.env.CI ? 'dot' : 'list',
  use: {
    baseURL: 'http://127.0.0.1:5175',
    trace: 'off',
    video: 'off',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'desktop',
      // The measured reference viewport; the whole pixel-diff loop depends on it.
      use: { ...devices['Desktop Chrome'], viewport: { width: 1376, height: 772 }, deviceScaleFactor: 1.5 },
    },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://127.0.0.1:5175',
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
