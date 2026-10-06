import { readFileSync, existsSync, statSync } from 'node:fs';
import { join } from 'node:path';

/**
 * verify:assets — the asset manifest must describe files that actually exist,
 * with declared rights. `null` in a core field is a not-yet-measured state and is
 * therefore a failure for anything in `usedBy`; `rights: publicly-accessible` is
 * never an acceptable value (plan §5.3).
 */
const ALLOWED_RIGHTS = new Set(['owned', 'licensed', 'permission-required', 'unverified']);
const PLACEHOLDER = /由实际采样文件填入|待采集|placeholder|TODO|FIXME/i;
const failures = [];
const warnings = [];

const manifestPath = 'src/content/assets.manifest.json';
if (!existsSync(manifestPath)) {
  console.error('FAIL: ' + manifestPath + ' missing');
  process.exit(1);
}
const raw = JSON.parse(readFileSync(manifestPath, 'utf8'));
const entries = Array.isArray(raw) ? raw : raw.assets ?? raw.entries ?? Object.entries(raw).map(([id, v]) => ({ id, ...v }));

let checked = 0;
for (const e of entries) {
  checked++;
  const where = `${e.id ?? '(no id)'}${e.kind ? '/' + e.kind : ''}`;
  if (!e.id) failures.push(`${where}: missing id`);
  if (!e.kind) failures.push(`${where}: missing kind`);
  if (!e.status) failures.push(`${where}: missing status`);
  if (!ALLOWED_RIGHTS.has(e.rights)) failures.push(`${where}: rights "${e.rights}" not in owned|licensed|permission-required|unverified`);
  if (e.localPath) {
    const p = e.localPath.startsWith('/') ? join('public', e.localPath) : e.localPath;
    if (!existsSync(p)) failures.push(`${where}: localPath does not exist -> ${p}`);
    else if (statSync(p).size === 0) failures.push(`${where}: localPath is empty -> ${p}`);
  } else if (e.kind !== 'procedural' && e.kind !== 'font' && e.kind !== 'icon') {
    failures.push(`${where}: no localPath and kind is not procedural`);
  }
  if (e.sourceEvidenceId === null && e.kind !== 'procedural') warnings.push(`${where}: sourceEvidenceId is null`);
  if (e.sha256 === null && e.status !== 'UNKNOWN') warnings.push(`${where}: sha256 not recorded`);
  if (PLACEHOLDER.test(JSON.stringify(e))) failures.push(`${where}: contains placeholder text`);
}

const unreferencedCore = entries.filter((e) => (e.usedBy ?? []).length > 0 && e.status === 'UNKNOWN');
for (const e of unreferencedCore) failures.push(`${e.id}: status UNKNOWN but referenced by ${e.usedBy.join(',')}`);

console.log(JSON.stringify({ checked, failures: failures.length, warnings: warnings.length }, null, 2));
if (failures.length) { console.error('verify:assets FAILED\n' + failures.slice(0, 40).join('\n')); process.exit(1); }
if (warnings.length) console.warn('warnings:\n' + warnings.slice(0, 20).join('\n'));
console.log('verify:assets PASSED');
