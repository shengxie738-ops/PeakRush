import { mkdirSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, join } from 'node:path';

const ORIGIN = 'https://follow.art';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36';
const OUT = 'evidence/reference/raw';

const css = [
  'entry.D4FdtiYZ.css', 'LoadingScreen.ByeB9m5w.css', 'Section.BriOt6td.css', 'Landing10JoinUs.DFvKynsT.css',
  'Group.EkqwFAZf.css', 'SocialNetworks.CXqD_S4s.css', 'TextUnderlineAnimation.DJa__wPY.css',
  'index.DRJU4ja6.css', 'Landing1IntroWebGl.DZK6hbZ4.css', 'Landing5NexusWebGl.DUcfhe4o.css',
  'Landing9TestimonialsWebGl.RzTllNCW.css', 'Landing7ConnectoryWebGl.Bm0q7C44.css'
];
const js = [
  'Bi84onXO.js', 'D69yCT-F.js', 'CN9o5T7v.js', 'Cc-BjTZB.js', 'B687kpCs.js', 'U-cHds8k.js', 'aCefYMbW.js',
  '6Hs0k2un.js', 'D0P05qe6.js', 'BpOVlWAq.js', 'xAAeZd5K.js', 'CCJzzdh0.js', 'XDSQCzXF.js', 'x_rD_Ya3.js',
  'tyNokC1P.js', 'CsBlc0Ci.js', 'CDL_IiwC.js', '8mlhRxUg.js', 'DeCikFp1.js', 'Kh3ydO16.js', 'E2LkYBIr.js',
  'Cz_qI31K.js', 'BnVPyHZU.js', 'B_ycc37t.js', 'wH0WNvJv.js', 'DrDDqcjH.js', 'DYI9G5xp.js', 'CRzV2p0b.js',
  'D9e1apFB.js', 'BsSV4kAi.js', 'CqdnIbrj.js', 'CrHBTwDc.js', 'C4ipafMf.js', 'si6jlswl.js'
];
const fonts = ['/fonts/HeadingNow-73Book.woff2', '/fonts/Hardbop-Bold.woff2'];
const svgs = ['line', 'star', 'vortex', 'emoji-smile', 'flower', 'loop-arrows', 'helix-decoration', 'the', 'promo-arrow']
  .map(n => `/images/landing/common/${n}.svg`)
  .concat(['/images/common/media-play.svg', '/images/common/usd-currency.svg', '/images/landing/9.testimonials/speech-balloon.svg',
    '/images/landing/10.join-us/us-word.svg', '/images/landing/4.follow-art/cross.svg', '/_nuxt/icons.g7tMF2ID.svg']);
const cards = Array.from({ length: 9 }, (_, i) => `/images/landing/1.intro/webgl/Card-${i + 1}.png`);
const persons = Array.from({ length: 10 }, (_, i) => `/images/landing/team/person-${i + 1}.jpg`);
const trails = Array.from({ length: 18 }, (_, i) => `/images/landing/10.join-us/trail-${i + 1}.png`);
const nexus = ['/images/landing/3.nexus/card-1.png', '/images/landing/3.nexus/card-2.png'];
const images = [...cards, ...persons, ...trails, ...nexus];

const targets = [
  ...css.map(f => ({ url: `/_nuxt/${f}`, kind: 'css' })),
  ...js.map(f => ({ url: `/_nuxt/${f}`, kind: 'js' })),
  ...fonts.map(u => ({ url: u, kind: 'font' })),
  ...svgs.map(u => ({ url: u, kind: 'svg' })),
  ...images.map(u => ({ url: u, kind: 'image' })),
  { url: '/_payload.json?63c1e131-150b-472a-8fd2-ea1d2a3b59fb', kind: 'payload', save: '/_payload.json' },
  { url: '/', kind: 'html' }
];

const manifest = [];
let i = 0;
async function worker() {
  while (i < targets.length) {
    const t = targets[i++];
    const abs = t.url.split('?')[0];
    const rel = t.save || abs;
    const dest = join(OUT, t.kind === 'html' ? 'index.html' : rel.replace(/^\//, ''));
    const res = await fetch(ORIGIN + t.url, { headers: { 'User-Agent': UA, Accept: '*/*', Referer: ORIGIN + '/' } }).catch(() => null);
    if (!res) { manifest.push({ url: t.url, kind: t.kind, status: 'fetch-error' }); continue; }
    const buf = Buffer.from(await res.arrayBuffer());
    const ct = res.headers.get('content-type');
    if (res.status !== 200) { manifest.push({ url: t.url, kind: t.kind, status: res.status, bytes: buf.length, ct }); continue; }
    mkdirSync(dirname(dest), { recursive: true });
    writeFileSync(dest, buf);
    manifest.push({ url: t.url, kind: t.kind, path: dest.replace(/\\/g, '/'), status: 200, ct, bytes: buf.length, sha256: createHash('sha256').update(buf).digest('hex').slice(0, 16) });
  }
}
await Promise.all(Array.from({ length: 4 }, worker));
mkdirSync(OUT, { recursive: true });
writeFileSync('evidence/reference/asset-manifest.json', JSON.stringify({ capturedAt: new Date().toISOString(), origin: ORIGIN, entries: manifest }, null, 2));
const ok = manifest.filter(m => m.status === 200);
const bad = manifest.filter(m => m.status !== 200);
console.log(JSON.stringify({ total: manifest.length, ok: ok.length, failed: bad.length, byKind: ok.reduce((a, m) => (a[m.kind] = (a[m.kind] || 0) + 1, a), {}), failures: bad.slice(0, 25) }, null, 2));
