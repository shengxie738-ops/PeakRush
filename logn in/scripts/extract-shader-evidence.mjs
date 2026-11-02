import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';

const raw = readFileSync('evidence/reference/raw-hero-shaders.txt', 'utf8');
const body = raw.replace(/^Script ran and returned untrusted page data:\s*/m, '').trim();
let payload = JSON.parse(body);
if (typeof payload === 'string') payload = JSON.parse(payload);

mkdirSync('evidence/reference/shaders', { recursive: true });

const summary = [];
payload.forEach((entry, i) => {
  const rec = { index: i, buffer: entry.buf, hasProgram: entry.hasProg, uniforms: entry.uniforms || null, files: {} };
  (entry.shaders || []).forEach((s) => {
    const f = `evidence/reference/shaders/hero-${i}.${s.t === 'V' ? 'vert' : 'frag'}.glsl`;
    writeFileSync(f, s.src);
    rec.files[s.t === 'V' ? 'vertex' : 'fragment'] = { path: f, chars: s.src.length };
    const custom = s.src.split('\n').filter((l) => /uniform|varying|in |out |attribute/.test(l) && !/USE_|#ifdef|#define|#if |precision|SHADER_TYPE|#version|#define/.test(l));
    rec[s.t === 'V' ? 'vertexDecls' : 'fragmentDecls'] = [...new Set(custom.map((l) => l.trim()))];
  });
  summary.push(rec);
});

writeFileSync('evidence/reference/shaders/hero-summary.json', JSON.stringify(summary, null, 2));
console.log(JSON.stringify(summary, null, 2));
