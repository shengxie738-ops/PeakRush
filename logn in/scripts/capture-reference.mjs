import { readFileSync } from 'node:fs';
import { capture } from './lib-capture.mjs';

/**
 * REFERENCE capture: read-only against https://follow.art.
 * Never pointed at a local origin, never submits a form, never clicks through to a
 * write action. Requires an explicit NEW-FREEZE flag because reference evidence is
 * immutable once captured (plan §14.1).
 */
const base = process.env.REFERENCE_URL ?? 'https://follow.art';
if (base !== 'https://follow.art') {
  console.error('REFUSED: capture:reference only targets https://follow.art, got ' + base);
  process.exit(2);
}
if (process.env.FREEZE_NEW_VERSION !== 'yes') {
  console.error('capture:reference creates a NEW frozen reference version. Re-run with FREEZE_NEW_VERSION=yes to confirm.');
  process.exit(3);
}
const checkpoints = JSON.parse(readFileSync('design/checkpoints.json', 'utf8'));
const viewports = (process.env.VIEWPORTS ?? 'primary').split(',');
const only = process.env.ONLY ? process.env.ONLY.split(',') : null;
await capture({ baseUrl: base, outDir: 'evidence/reference/captured', checkpoints, viewports, target: 'reference', only });
