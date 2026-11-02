import { readFileSync } from 'node:fs';
import { capture } from './lib-capture.mjs';

/** LOCAL capture only. Refuses to point at anything but a loopback origin. */
const base = process.env.LOCAL_BASE_URL ?? 'http://127.0.0.1:5175';
if (!/^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(base)) {
  console.error('REFUSED: LOCAL_BASE_URL must be a loopback origin, got ' + base);
  process.exit(2);
}
const checkpoints = JSON.parse(readFileSync('design/checkpoints.json', 'utf8'));
const viewports = (process.env.VIEWPORTS ?? 'primary').split(',');
const only = process.env.ONLY ? process.env.ONLY.split(',') : null;
await capture({ baseUrl: base, outDir: 'evidence/local', checkpoints, viewports, target: 'local', only });
