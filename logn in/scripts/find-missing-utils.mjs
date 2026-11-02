import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

function walk(dir, acc = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, acc);
    else acc.push(p);
  }
  return acc;
}

const css = walk('src/styles')
  .filter((f) => f.endsWith('.css'))
  .map((f) => readFileSync(f, 'utf8'))
  .join('\n');

const vue = walk('src').filter((f) => f.endsWith('.vue'));
const used = new Set();
for (const f of vue) {
  const src = readFileSync(f, 'utf8');
  for (const m of src.matchAll(/class="([^"]*)"/g)) {
    for (const tok of m[1].split(/\s+/)) if (tok && !tok.includes('$')) used.add(tok);
  }
  for (const m of src.matchAll(/'([a-z][a-z0-9]*(?:-[a-z0-9.:]+)+)'/g)) used.add(m[1]);
}

/* the authored CSS escapes punctuation in selectors (.pt-1\.25, .col--5\:md),
   so allow an optional backslash in front of every special character */
const SPECIAL = new Set(['.', ':', '/', '!', '#', '@', '*', '+', '?', '^', '$', '{', '}', '(', ')', '|', '[', ']', '\\']);
const sel = (c) =>
  c
    .split('')
    .map((ch) => (SPECIAL.has(ch) ? '(?:\\\\?' + ch + ')' : ch))
    .join('');
const candidates = [...used].filter((c) => /^[a-z][a-z0-9_.:-]*$/.test(c) && c.includes('-'));
const missing = candidates
  .filter((c) => !new RegExp('\\.' + sel(c) + '(?![A-Za-z0-9_-])').test(css))
  .sort();
console.log('classes used:', candidates.length, '| missing from src/styles/*.css:', missing.length);
for (const m of missing) console.log('  ' + m);
