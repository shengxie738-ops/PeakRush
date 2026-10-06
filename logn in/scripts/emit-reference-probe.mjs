import { readFileSync, writeFileSync } from 'node:fs';

/**
 * Emit the in-app Browser function text that runs a probe body inside a hidden SAME-ORIGIN iframe
 * of the reference site.
 *
 * Why this exists: `scripts/run-page-body.mjs` runs a body file against the loopback clone, and the
 * reference side must run the *identical* text — a divergent probe turns measurement error into a
 * fake fidelity delta. Hand-copying 3 KB of JS into an `evaluate_script` call is where drift creeps
 * in, so the wrapper is generated and the body is embedded verbatim from disk.
 *
 * The body is inlined into a template literal, which is only safe because probe bodies are
 * backslash-free, backtick-free and ${-free (enforced by scripts/check-probe-bodies.mjs).
 *
 * The emitted function creates (or reuses) #qoder-probe-frame at the forensic viewport, waits for
 * hydration, then evals the body in the IFRAME realm. It leaves the iframe standing so a later call
 * can run another body; TEARDOWN must always be the last step.
 *
 * Usage:
 *   node scripts/emit-reference-probe.mjs <route> <body-file> [outFile]
 *   node scripts/emit-reference-probe.mjs --teardown
 */
if (process.argv[2] === '--teardown') {
  const fn = `() => { const f = document.getElementById('qoder-probe-frame'); if (f) f.remove(); return JSON.stringify({ tornDown: !!f, href: location.href }); }`;
  console.log(fn);
  process.exit(0);
}

const [route, bodyFile, outFile] = process.argv.slice(2);
if (!route || !bodyFile) {
  console.error('usage: node scripts/emit-reference-probe.mjs <route> <body-file> [outFile]');
  process.exit(2);
}
if (/^https?:\/\//.test(route)) {
  console.error('REFUSED: pass a same-origin route (e.g. /pricing), never an absolute URL — the tab is already on the reference origin.');
  process.exit(2);
}
if (!route.startsWith('/')) {
  // Git Bash (MSYS) rewrites a leading-slash argv into a Windows path: `/pricing` arrived here as
  // `C:/Users/.../bin/git/pricing`. Call with MSYS_NO_PATHCONV=1 rather than passing a mangled route.
  console.error(`REFUSED: route does not start with / (got ${JSON.stringify(route)}). If this is Git Bash, re-run with MSYS_NO_PATHCONV=1.`);
  process.exit(2);
}

const body = readFileSync(bodyFile, 'utf8');
for (const [needle, why] of [['\\', 'backslashes get eaten by the embedding layer'], ['`', 'a backtick would close the wrapper template literal'], ['${', 'interpolation would run in the wrapper, not the page']]) {
  if (body.includes(needle)) {
    console.error(`REFUSED: ${bodyFile} contains ${JSON.stringify(needle)} — ${why}. Fix the body (scripts/check-probe-bodies.mjs enforces this).`);
    process.exit(2);
  }
}

const WRAPPER = [
  'async () => {',
  '  const ROUTE = @ROUTE@;',
  '  const BODY = `@BODY@`;',
  "  let f = document.getElementById('qoder-probe-frame');",
  '  if (!f || !f.contentWindow || !f.contentDocument) {',
  "    f = document.createElement('iframe');",
  "    f.id = 'qoder-probe-frame';",
  "    f.setAttribute('style', 'position:fixed;left:0;top:0;width:1376px;height:772px;border:0;visibility:hidden;z-index:-1;');",
  '    f.src = ROUTE;',
  '    document.body.appendChild(f);',
  '    await new Promise((r) => setTimeout(r, 5000));',
  '  } else if (f.contentDocument.location.pathname !== ROUTE) {',
  '    // Re-navigate through the iframe SPA router so the app shell is not rebuilt from scratch.',
  "    const app = f.contentDocument.querySelector('#__nuxt');",
  '    const router = app && app.__vue_app__ && app.__vue_app__.config.globalProperties.$router;',
  '    if (router) { await router.push(ROUTE); } else { f.src = ROUTE; }',
  '    await new Promise((r) => setTimeout(r, 5000));',
  '  } else {',
  '    await new Promise((r) => setTimeout(r, 800));',
  '  }',
  '  const d = f.contentDocument;',
  "  if (!d || d.readyState !== 'complete') return JSON.stringify({ error: 'iframe not ready', state: d ? d.readyState : 'null' });",
  "  if (!d.querySelector('.scrollable__area')) return JSON.stringify({ error: 'app shell did not hydrate', path: d.location.pathname });",
  "  const out = await f.contentWindow.eval('(' + BODY.trim() + ')()');",
  '  const parsed = typeof out === "string" ? JSON.parse(out) : out;',
  '  parsed.__bodyChars = BODY.trim().length;',
  '  return JSON.stringify(parsed);',
  '}',
].join('\n');

const fn = WRAPPER.replace('@ROUTE@', () => JSON.stringify(route)).replace('@BODY@', () => body.trim());
if (outFile) writeFileSync(outFile, fn);
console.log(fn);
