import { readFileSync, writeFileSync } from 'node:fs';
import { chromium } from '@playwright/test';

const svgs = JSON.parse(readFileSync('scripts/_svgs.json', 'utf8'));
const rows = svgs
  .map((e, i) => {
    const vb = e.attrs.find(([k]) => k === 'viewBox')?.[1] ?? '';
    const html = e.html.replace(/fill="white"/g, 'fill="#111"').replace(/fill="black"/g, 'fill="#111"').replace(/fill="#fff"/g, 'fill="#111"').replace(/fill="#000"/g, 'fill="#111"');
    return `<section><h3>#${i} ${e.class} &nbsp; viewBox=${vb} &nbsp; paths=${e.paths.length}</h3><div class="box">${html}</div></section>`;
  })
  .join('');
writeFileSync(
  'scripts/_sheet.html',
  `<!doctype html><meta charset=utf-8><style>body{margin:0;background:#eee;font:12px system-ui}h3{margin:6px 10px 2px}.box svg{display:block;width:520px;height:auto;background:#fff;margin:0 10px 10px}</style>${rows}`,
);

const b = await chromium.launch();
const p = await (await b.newContext({ viewport: { width: 1100, height: 1400 } })).newPage();
await p.goto('file:///' + process.cwd().replace(/\\/g, '/') + '/scripts/_sheet.html', { waitUntil: 'networkidle' });
await p.screenshot({ path: 'scripts/_sheet.png', fullPage: true });
await b.close();
console.log('ok');
