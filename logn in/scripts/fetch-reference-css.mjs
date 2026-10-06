import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { basename } from 'node:path';

/**
 * Download reference-site static chunks (CSS and JS) into evidence/reference/raw/_nuxt/.
 *
 * Cloudflare's interstitial blocks HTML, _payload.json and automated browsers, but static asset
 * paths (CSS/JS/fonts/images) go through — that asymmetry is what makes this possible at all
 * (see the project memory note on China/Cloudflare-reachable sources).
 *
 * Files are keyed by their hashed basename and existing ones are kept, so a re-run only fills gaps.
 * The report path is derived from the URL list so a JS sweep cannot overwrite the CSS one.
 *
 * Usage: node scripts/fetch-reference-css.mjs [urls.json]
 */
const urlFile = process.argv[2] ?? 'evidence/reference/raw/_css-manifest-urls.json';
const outDir = 'evidence/reference/raw/_nuxt';
if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });

const urls = JSON.parse(readFileSync(urlFile, 'utf8'));
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36';

const index = [];
let fetched = 0;
let skipped = 0;
let failed = 0;

for (let i = 0; i < urls.length; i += 4) {
  const batch = urls.slice(i, i + 4);
  const results = await Promise.all(
    batch.map(async (url) => {
      const name = basename(new URL(url).pathname);
      const dest = `${outDir}/${name}`;
      if (existsSync(dest)) {
        const buf = readFileSync(dest);
        return { url, name, status: 'cached', bytes: buf.length, sha256: createHash('sha256').update(buf).digest('hex') };
      }
      try {
        const res = await fetch(url, { headers: { 'User-Agent': UA, Referer: 'https://follow.art/', Accept: 'text/css,*/*;q=0.1' }, redirect: 'follow' });
        if (!res.ok) return { url, name, status: `http ${res.status}` };
        const buf = Buffer.from(await res.arrayBuffer());
        const text = buf.toString('utf8');
        if (/<html|cf-browser-verification|Just a moment/i.test(text.slice(0, 400))) {
          return { url, name, status: 'blocked-by-challenge', bytes: buf.length };
        }
        writeFileSync(dest, buf);
        return { url, name, status: 'ok', bytes: buf.length, sha256: createHash('sha256').update(buf).digest('hex') };
      } catch (e) {
        return { url, name, status: 'error', error: String(e.message).slice(0, 120) };
      }
    }),
  );
  for (const r of results) {
    if (r.status === 'cached') skipped += 1;
    else if (r.status === 'ok') fetched += 1;
    else failed += 1;
    index.push(r);
    console.log(`${r.status.padEnd(20)} ${r.name}${r.bytes ? ' ' + r.bytes + 'B' : ''}${r.error ? ' ' + r.error : ''}`);
  }
}

const reportPath = urlFile.replace(/-urls\.json$/, '-fetch-report.json');
if (reportPath === urlFile) console.warn('NOTE: URL list is not named *-urls.json, writing the shared CSS report');
writeFileSync(reportPath === urlFile ? 'evidence/reference/raw/_css-fetch-report.json' : reportPath, JSON.stringify({ fetchedAt: new Date().toISOString(), urlFile, total: urls.length, fetched, cached: skipped, failed, files: index }, null, 2));
console.log(`\nreport: ${reportPath}\nfetched=${fetched} cached=${skipped} failed=${failed} of ${urls.length}`);
process.exit(failed ? 1 : 0);
