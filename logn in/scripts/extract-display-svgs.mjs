/**
 * Throwaway extractor: pulls the inline display-word <svg> glyph sets out of the
 * compiled reference render functions and prints them as {class, html, bytes}.
 * Run: node scripts/extract-display-svgs.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs';

const FILES = [
  'evidence/reference/raw/_nuxt/Cc-BjTZB.js',
  'evidence/reference/raw/_nuxt/CCJzzdh0.js',
];

/** Balanced-delimiter scan that respects JS string literals. */
function scan(src, start, open, close) {
  let depth = 0;
  let inStr = false;
  let esc = false;
  for (let i = start; i < src.length; i += 1) {
    const ch = src[i];
    if (inStr) {
      if (esc) esc = false;
      else if (ch === '\\') esc = true;
      else if (ch === '"') inStr = false;
      continue;
    }
    if (ch === '"') inStr = true;
    else if (ch === open) depth += 1;
    else if (ch === close) {
      depth -= 1;
      if (depth === 0) return src.slice(start, i + 1);
    }
  }
  return null;
}

/** Split a JS object literal into top-level key -> raw value source. */
function parseObject(objSrc) {
  const body = objSrc.slice(1, -1);
  const pairs = [];
  let depth = 0;
  let inStr = false;
  let esc = false;
  let cur = '';
  for (let i = 0; i < body.length; i += 1) {
    const ch = body[i];
    if (inStr) {
      cur += ch;
      if (esc) esc = false;
      else if (ch === '\\') esc = true;
      else if (ch === '"') inStr = false;
      continue;
    }
    if (ch === '"') {
      inStr = true;
      cur += ch;
      continue;
    }
    if ('([{'.includes(ch)) depth += 1;
    else if (')]}'.includes(ch)) depth -= 1;
    if (ch === ',' && depth === 0) {
      pairs.push(cur);
      cur = '';
    } else cur += ch;
  }
  if (cur.trim()) pairs.push(cur);

  const out = [];
  for (const pair of pairs) {
    const m = /^\s*("?[A-Za-z0-9_$-]+"?)\s*:\s*/.exec(pair);
    if (!m) continue;
    const key = m[1].replace(/^"|"$/g, '');
    out.push([key, pair.slice(m[0].length).trim()]);
  }
  return out;
}

/** A literal string/number value, or null when the value is a runtime expression. */
function literalValue(raw) {
  if (/^"/.test(raw)) {
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }
  if (/^-?\d+(\.\d+)?$/.test(raw)) return raw;
  return null;
}


function collectPaths(src, arrayStart) {
  /* the compiled children slot is either  [t("path",…),…]  or the hoisted
     cache form  l[0]||(l[0]=[t("path",…,…)])  — locate the array opening
     bracket as the last `[` before the first "path" element. */
  const first = /\("path",\s*\{/.exec(src.slice(arrayStart));
  if (!first) return [];
  const pathIdx = arrayStart + first.index;
  const openIdx = src.lastIndexOf('[', pathIdx);
  if (openIdx < arrayStart) return [];
  const arr = scan(src, openIdx, '[', ']');
  if (!arr) return [];
  const paths = [];
  const re = /\("path",\s*\{/g;
  let m;
  while ((m = re.exec(arr)) !== null) {
    const braceStart = m.index + m[0].length - 1;
    const obj = scan(arr, braceStart, '{', '}');
    if (!obj) continue;
    const pairs = parseObject(obj);
    const attrs = [];
    for (const [k, raw] of pairs) {
      const v = literalValue(raw);
      if (v !== null) attrs.push([k, v]);
    }
    if (attrs.some(([k]) => k === 'd')) paths.push(attrs);
  }
  return paths;
}

function serialize(tag, attrs, children) {
  const head = attrs.map(([k, v]) => `${k}="${String(v).replace(/"/g, '&quot;')}"`).join(' ');
  return `<${tag} ${head}>${children.join('')}</${tag}>`;
}

/** Find every svg element in a chunk and index it by its class attribute. */
function extractSvgs(src) {
  const found = [];
  const re = /\("svg",\s*\{/g;
  let m;
  while ((m = re.exec(src)) !== null) {
    const braceStart = m.index + m[0].length - 1;
    const obj = scan(src, braceStart, '{', '}');
    if (!obj) continue;
    const attrs = [];
    for (const [k, raw] of parseObject(obj)) {
      const v = literalValue(raw);
      if (v !== null) attrs.push([k, v]);
    }
    const cls = attrs.find(([k]) => k === 'class')?.[1] ?? '';
    const paths = collectPaths(src, braceStart + obj.length);
    if (!paths.length) continue;
    found.push({
      class: cls,
      attrs,
      paths,
      at: m.index,
      html: serialize(
        'svg',
        attrs.filter(([k]) => k !== 'style'),
        paths.map((p) => `<path ${p.map(([k, v]) => `${k}="${String(v).replace(/"/g, '&quot;')}"`).join(' ')} />`),
      ),
    });
  }
  return found;
}

const all = [];
for (const file of FILES) {
  const src = readFileSync(file, 'utf8');
  for (const entry of extractSvgs(src)) all.push({ ...entry, file: file.split('/').pop() });
}

for (const e of all) {
  console.log(
    `${e.file} @${e.at}\n  class="${e.class}"\n  viewBox=${e.attrs.find(([k]) => k === 'viewBox')?.[1]} paths=${e.paths.length} bytes=${e.html.length}\n`,
  );
}

writeFileSync('scripts/_svgs.json', JSON.stringify(all, null, 1));
console.log('wrote scripts/_svgs.json');
