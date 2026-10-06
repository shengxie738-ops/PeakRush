import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Guard the probe-body invariants that cost a whole evidence set in round 33.
 *
 * Every file in scripts/bodies/ travels through TWO parsers: once as Node reads it, once when it
 * is embedded in an in-app Browser `evaluate_script` template literal (or `iframe.contentWindow.eval`).
 * A backslash escape therefore silently changes meaning on the reference side — `/[\s]+/g` became
 * `/s+/g` and rewrote every captured text field. This gate refuses such bodies outright.
 *
 * Usage: node scripts/check-probe-bodies.mjs
 */
const dir = 'scripts/bodies';
const files = readdirSync(dir).filter((f) => f.endsWith('.mjs'));
let bad = 0;

for (const f of files) {
  const src = readFileSync(join(dir, f), 'utf8');
  const problems = [];
  if (src.includes('\\')) problems.push(`contains a backslash (${(src.match(/\\/g) ?? []).length}x) — escapes get eaten by the embedding layer`);
  if (src.includes('`')) problems.push('contains a backtick — breaks the template literal wrapper');
  if (src.includes('${')) problems.push('contains ${ — interpolation would run in the wrapper, not the page');
  try {
    new Function(src);
  } catch (e) {
    problems.push('does not parse: ' + e.message);
  }
  const args = src.slice(0, src.indexOf('=>'));
  if (!/^\s*(?:async\s+)?\(\s*\)\s*=>/.test(src)) problems.push(`not a zero-arg arrow function (starts ${JSON.stringify(args.slice(0, 30))})`);
  if (problems.length) {
    bad += 1;
    console.log(`FAIL ${f}`);
    for (const p of problems) console.log(`     - ${p}`);
  } else {
    console.log(`ok   ${f}  (${src.length} bytes)`);
  }
}

console.log(`\n${files.length - bad}/${files.length} probe bodies satisfy the both-sides invariants.`);
process.exit(bad ? 1 : 0);
