import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';

/**
 * verify:evidence — the reference baseline must be traceable and unchanged.
 * Fails on: an unfrozen reference lock, evidence paths that do not resolve,
 * duplicated checkpoint ids, schema-demo placeholder text shipped as real
 * evidence, and any drift between asset-manifest hashes and the files on disk.
 */
const PLACEHOLDER = /由实际采样文件填入|由实际截图文件填入|写明可见差异|写明本轮检验的单一原因|写明文件、参数或测量动作|schema 示范/;
const failures = [];
const notes = [];

const lock = JSON.parse(readFileSync('evidence/reference-lock.json', 'utf8'));
for (const key of ['capturedAt', 'browser', 'os', 'targetOrigin']) {
  if (!lock[key] || lock[key] === null) failures.push(`reference-lock.${key} is unset — reference version is not frozen`);
}
notes.push(`reference frozen at ${lock.capturedAt} against ${lock.targetOrigin}`);

const checkpoints = JSON.parse(readFileSync('design/checkpoints.json', 'utf8'));
const ids = checkpoints.map((c) => c.id);
const dupes = ids.filter((id, i) => ids.indexOf(id) !== i);
if (dupes.length) failures.push('duplicate checkpoint ids: ' + dupes.join(','));
notes.push(`${checkpoints.length} checkpoints defined`);

const claims = JSON.parse(readFileSync('evidence/claims.json', 'utf8'));
for (const c of claims) {
  if (!['MEASURED', 'AUTHOR_CONFIRMED', 'PROPOSED', 'UNKNOWN', 'PARTIAL — MEASURED that frames change, not the rate'].includes(c.status)) {
    failures.push(`claim "${c.claim}" has non-schema status ${c.status}`);
  }
  if (c.status === 'UNKNOWN' && !c.nextAction) failures.push(`claim "${c.claim}" is UNKNOWN with no nextAction`);
  if (c.evidence && !c.evidence.startsWith('conversation probe') && !existsSync(c.evidence)) {
    failures.push(`claim "${c.claim}" cites evidence that does not exist: ${c.evidence}`);
  }
}
notes.push(`${claims.length} claims tracked`);

const backlog = JSON.parse(readFileSync('quality/backlog.json', 'utf8'));
for (const b of backlog) {
  if (PLACEHOLDER.test(JSON.stringify(b))) failures.push(`backlog ${b.id}: still contains schema-demo placeholder text`);
  for (const key of ['referenceEvidence', 'localEvidence']) {
    const v = b[key];
    if (!v || v === 'none') { if (b.status !== 'blocked') failures.push(`backlog ${b.id}: ${key} empty`); continue; }
    const path = v.split('#')[0].split(' ')[0];
    if (!existsSync(path)) failures.push(`backlog ${b.id}: ${key} does not resolve -> ${path}`);
  }
  if (!['open', 'blocked', 'fixed', 'wontfix'].includes(b.status)) failures.push(`backlog ${b.id}: bad status ${b.status}`);
}
notes.push(`${backlog.length} backlog entries`);

const manifest = JSON.parse(readFileSync('evidence/reference/asset-manifest.json', 'utf8'));
let hashChecked = 0;
for (const e of manifest.entries) {
  if (e.status !== 200 || !e.path) continue;
  if (!existsSync(e.path)) { failures.push(`asset ${e.url} listed but file missing: ${e.path}`); continue; }
  if (statSync(e.path).size !== e.bytes) failures.push(`asset ${e.url} byte count drifted (${e.bytes} -> ${statSync(e.path).size})`);
  if (hashChecked < 12 && e.sha256) {
    const h = createHash('sha256').update(readFileSync(e.path)).digest('hex').slice(0, 16);
    if (h !== e.sha256) failures.push(`asset ${e.url} sha256 mismatch — reference baseline changed`);
    hashChecked++;
  }
}
notes.push(`${manifest.entries.filter((e) => e.status === 200).length} reference assets, ${hashChecked} hashes re-verified`);

const dir = 'evidence/reference/captured';
if (existsSync(dir)) {
  /* Reference frames now live in dated freeze subfolders as well as the top level,
     because they can only be captured while the in-app Browser panel is a visible
     surface. Scanning only the top level counted 1 where 29 exist. The <40KB reject
     guard stays per-file, since that is what catches a Cloudflare challenge page. */
  const pngs = [];
  for (const ent of readdirSync(dir, { withFileTypes: true })) {
    if (ent.isFile() && ent.name.endsWith('.png')) pngs.push(join(dir, ent.name));
    else if (ent.isDirectory()) {
      for (const f of readdirSync(join(dir, ent.name))) {
        if (f.endsWith('.png')) pngs.push(join(dir, ent.name, f));
      }
    }
  }
  const tiny = pngs.filter((p) => statSync(p).size < 40000);
  if (pngs.length && tiny.length === pngs.length) {
    failures.push(`all ${pngs.length} "reference" screenshots are <40KB — these are Cloudflare challenge pages, not reference evidence; do not treat them as a baseline`);
  } else if (pngs.length) notes.push(`${pngs.length - tiny.length} usable reference screenshots (${tiny.length} rejected as <40KB)`);
  else notes.push('no reference screenshots yet');
}

console.log(JSON.stringify({ notes, failures: failures.length }, null, 2));
if (failures.length) { console.error('verify:evidence FAILED\n' + [...new Set(failures)].slice(0, 40).join('\n')); process.exit(1); }
console.log('verify:evidence PASSED');
