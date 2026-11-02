import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, basename } from 'node:path';

/**
 * Builds src/content/assets.manifest.json in the plan §5.2 schema by joining
 *   evidence/reference/asset-manifest.json  (what the reference served, + sha256)
 *   public/**                               (what this clone actually ships)
 *   src/**                                  (which component asks for it)
 *
 * Rights are deliberately conservative: nothing downloaded from the live site is
 * "licensed" or "owned" by this project. `publicly-accessible` is never a rights
 * value (plan §5.3), so every reference-sourced file is `permission-required`, and
 * anything we could not trace back to a real request is `unverified`.
 */

const refManifest = JSON.parse(readFileSync('evidence/reference/asset-manifest.json', 'utf8')).entries;
const byBasename = new Map();
/** Vite/rollup strips the build hash when we rename a file into public/, so match
 *  on the de-hashed stem too — otherwise `icons.g7tMF2ID.svg` never joins to
 *  `icons.svg` and a genuinely traced asset is reported as untraceable. */
const dehash = (name) => name.replace(/\.[A-Za-z0-9_-]{6,10}(?=\.)/g, '');
for (const e of refManifest) {
  if (e.status !== 200 || !e.path) continue;
  byBasename.set(basename(e.path), e);
  byBasename.set(dehash(basename(e.path)), e);
}

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}

const srcText = ['src', 'index.html'].flatMap((d) => {
  if (!existsSync(d)) return [];
  const stat = statSync(d);
  const files = stat.isDirectory() ? walk(d) : [d];
  return files.filter((f) => /\.(ts|vue|css|html|json)$/.test(f)).map((f) => readFileSync(f, 'utf8'));
}).join('\n');

const localFiles = walk('public').filter((f) => !f.endsWith('manifest.json'));
const assets = [];

for (const local of localFiles) {
  const urlPath = '/' + local.replace(/^public[\\/]/, '').replace(/\\/g, '/');
  const ref = byBasename.get(basename(local));
  const usedBy = [];
  const stem = basename(local).replace(/\.[^.]+$/, '');
  if (srcText.includes(stem) || srcText.includes(urlPath)) usedBy.push('see grep of src for "' + stem + '"');
  const buf = readFileSync(local);
  const ext = basename(local).split('.').pop().toLowerCase();
  const kind = ['png', 'jpg', 'jpeg', 'webp', 'avif', 'gif'].includes(ext) ? 'image-texture'
    : ext === 'svg' ? 'vector'
    : ['woff2', 'woff'].includes(ext) ? 'font'
    : ext === 'mp4' || ext === 'webm' ? 'video' : 'file';
  assets.push({
    id: urlPath.replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, ''),
    kind,
    referenceUrl: ref ? ref.url : null,
    sourceEvidenceId: ref ? 'evidence/reference/asset-manifest.json' : null,
    status: ref ? 'MEASURED' : 'UNKNOWN',
    localPath: local.replace(/\\/g, '/'),
    servedAt: urlPath,
    bytes: buf.length,
    sha256: createHash('sha256').update(buf).digest('hex').slice(0, 16),
    rights: ref ? 'permission-required' : 'unverified',
    usedBy,
    fallbackId: null,
    nextAction: ref ? 'confirm redistribution rights before any public deployment' : 'trace this file back to a real reference request or replace it',
  });
}

const unreferenced = assets.filter((a) => a.usedBy.length === 0);
writeFileSync('src/content/assets.manifest.json', JSON.stringify({
  schemaVersion: 2,
  generatedBy: 'scripts/build-asset-manifest.mjs',
  referenceBuild: 'v_1790676598601 / nuxt 63c1e131-150b-472a-8fd2-ea1d2a3b59fb',
  rightsPolicy: 'Nothing here is owned or licensed by this project. Reference-sourced files are permission-required; untraceable files are unverified.',
  counts: { total: assets.length, measured: assets.filter((a) => a.status === 'MEASURED').length, notReferencedBySrc: unreferenced.length },
  assets,
}, null, 2));

console.log(JSON.stringify({ total: assets.length, measured: assets.filter((a) => a.status === 'MEASURED').length, untraceable: assets.filter((a) => a.status === 'UNKNOWN').map((a) => a.localPath), notReferencedBySrc: unreferenced.map((a) => a.localPath).slice(0, 25) }, null, 2));
