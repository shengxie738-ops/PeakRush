import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, basename, join } from 'node:path';

/**
 * Second reference-asset batch: the sub-page and section artwork discovered while
 * reading the live DOM (testimonials reviews, connectory image, gift-card set,
 * about team + partners, nexus-card decorations, get-seen preview).
 *
 * Re-fetches every path for real so the recorded bytes/sha256 describe what the
 * server actually served, then merges into evidence/reference/asset-manifest.json.
 */
const ORIGIN = 'https://follow.art';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36';

const paths = [
  '/images/landing/2.get-seen/video-preview.png',
  '/images/landing/7.connectory/image.png',
  ...Array.from({ length: 8 }, (_, i) => `/images/landing/9.testimonials/Review-${i + 1}.png`),
  '/images/common/menu-decoration.png',
  '/images/common/star-white.svg',
  '/images/common/media-play-white.svg',
  '/images/common/subscribe-black.svg',
  '/images/card/edit/subscribe.svg',
  '/images/nexus-card/subscription-and-pricing/title-decoration.svg',
  '/images/nexus-card/icons/the-word.svg',
  '/images/nexus-card/icons/your-word.svg',
  '/images/nexus-card/icons/time-forward.svg',
  '/images/landing/common/promo-arrow-orange.svg',
  '/images/about/1.our-story/webby-logo.svg',
  '/images/about/1.our-story/preview-1-mobile.png',
  '/images/about/1.our-story/preview-2-mobile.png',
  '/images/about/1.our-story/preview-3-mobile.png',
  '/images/about/1.our-story/preview-4-mobile.png',
  ...['veronika-gorbacova', 'evelina-gorbacova', 'anton-persianov', 'ksenija-labecka', 'pricila-lto', 'diana-novicka', 'bruno-mellis'].map((n) => `/images/about/2.team/${n}.jpg`),
  ...['art-fairs-service', 'vaa', 'zuzeum', 'museum-of-pacific', 'young-painter-prize', 'cci', 'all-about-art', 'aac', 'volta', 'worlding-project'].map((n) => `/images/about/4.partners/${n}.svg`),
  ...['buy', 'image', 'video-preview', 'vaa', 'artdaily', 'vao', 'all-about-art', 'world-art-news', 'cold', '18-83', 'art-plugged', 'ypp'].map((n) => `/images/gift-card/${n}.${n === 'image' || n === 'video-preview' || ['vaa', 'artdaily', 'vao', 'all-about-art', 'world-art-news', 'cold', '18-83', 'art-plugged', 'ypp'].includes(n) ? 'png' : 'svg'}`),
];

const manifest = JSON.parse(readFileSync('evidence/reference/asset-manifest.json', 'utf8'));
const known = new Set(manifest.entries.map((e) => e.url));
let added = 0;
const failed = [];

for (const p of paths) {
  if (known.has(p)) continue;
  const res = await fetch(ORIGIN + p, { headers: { 'User-Agent': UA, Referer: ORIGIN + '/' } }).catch(() => null);
  if (!res || res.status !== 200) { failed.push(`${p} -> ${res ? res.status : 'fetch-error'}`); continue; }
  const buf = Buffer.from(await res.arrayBuffer());
  const dest = join('evidence/reference/raw', p.replace(/^\//, ''));
  mkdirSync(dirname(dest), { recursive: true });
  writeFileSync(dest, buf);
  manifest.entries.push({
    url: p,
    kind: /\.(png|jpe?g|webp|avif)$/.test(p) ? 'image' : 'svg',
    path: dest.replace(/\\/g, '/'),
    status: 200,
    ct: res.headers.get('content-type'),
    bytes: buf.length,
    sha256: createHash('sha256').update(buf).digest('hex').slice(0, 16),
    batch: 2,
  });
  added++;
}

manifest.capturedAt2 = new Date().toISOString();
writeFileSync('evidence/reference/asset-manifest.json', JSON.stringify(manifest, null, 2));
console.log(JSON.stringify({ added, alreadyKnown: paths.length - added - failed.length, failed }, null, 2));
void basename;
