/**
 * Throwaway: serve the production build on a loopback port and run the visual
 * probe against it, so the numbers can be verified even while the shared dev
 * server is blocked by another agent's in-flight edit.
 */
import { createServer } from 'node:http';
import { readFileSync, writeFileSync, existsSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const runProbe = promisify(execFile);

const ROOT = join(process.cwd(), 'dist');
const MIME = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.woff': 'font/woff', '.woff2': 'font/woff2', '.json': 'application/json',
};

const server = createServer((req, res) => {
  const url = decodeURIComponent((req.url || '/').split('?')[0]);
  let file = join(ROOT, url);
  if (!existsSync(file) || statSync(file).isDirectory()) file = join(ROOT, 'index.html');
  res.writeHead(200, { 'content-type': MIME[extname(file)] ?? 'application/octet-stream' });
  res.end(readFileSync(file));
});

await new Promise((r) => server.listen(5199, '127.0.0.1', r));
console.log('serving dist on http://127.0.0.1:5199');

const run = async (tag, vp) => {
  let text = '';
  try {
    const { stdout } = await runProbe(process.execPath, ['scripts/probe-visual.mjs'], {
      encoding: 'utf8',
      maxBuffer: 64 * 1024 * 1024,
      env: { ...process.env, BASE_URL: 'http://127.0.0.1:5199', FLAT: '1', ...(vp ? { VP: vp } : {}) },
    });
    text = stdout;
  } catch (e) {
    console.log('\n===== ' + tag + ' FAILED =====');
    console.log(String(e.message).slice(0, 400));
    return '';
  }
  const file = vp === 'oracle' ? 'dist-oracle.json' : 'dist-1440.json';
  writeFileSync(file, text);
  console.log('\n===== ' + tag + ' -> ' + file + ' (' + text.length + ' bytes) =====');
  return text;
};

const a = await run('dist @1440x900', null);
const b = await run('dist @1376x772 (oracle viewport)', 'oracle');
console.log('\nboth probes returned JSON:', Boolean(a && b));

server.close();
