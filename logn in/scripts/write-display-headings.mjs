import { readFileSync, writeFileSync } from 'node:fs';

const svgs = JSON.parse(readFileSync('scripts/_svgs.json', 'utf8'));

const MAP = [
  ['follow-art', 'intro__title is-hidden:sm-down svg-fix'],
  ['card', 'section-5__title--desktop is-hidden:sm-down svg-fix'],
  ['testimonials', 'section-9__title--desktop is-hidden:sm-down svg-fix'],
  ['connectory', 'section-7__title--desktop img-full is-hidden:sm-down svg-fix'],
  ['join-us', 'section-10__title--desktop img-full is-hidden:sm-down svg-fix'],
  ['get-seen-icon-1', 'section-2__title-icon-1 icon-shake'],
  ['get-seen-icon-2', 'section-2__title-icon-2 icon-shake-reverse'],
];

const out = {};
const missing = [];
for (const [key, cls] of MAP) {
  const hit = svgs.find((e) => e.class === cls);
  if (!hit) {
    missing.push(key);
    continue;
  }
  out[key] = { class: hit.class, html: hit.html, bytes: hit.html.length };
}

writeFileSync('src/content/displayHeadings.json', JSON.stringify(out, null, 2) + '\n');
console.log('keys:', Object.keys(out).join(', '));
console.log('missing:', missing.length ? missing.join(', ') : 'none');
for (const [k, v] of Object.entries(out)) console.log(k, v.bytes, 'bytes');
