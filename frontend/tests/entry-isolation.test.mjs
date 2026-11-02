import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

/**
 * Guards the one invariant the merged toolchain cannot enforce by construction.
 *
 * `frontend/tsconfig.json` maps `paths: {"@/*": ["welcome/*"]}` and `vite.config.ts`
 * maps `resolve.alias {"@": ./welcome}`. Both are global, not scoped to the clone. So a
 * `@/x` written inside the MAIN app resolves into the CLONE — and it does so with zero
 * diagnostics: vue-tsc reports nothing and the build bundles the cross-entry module
 * happily, which silently dissolves the document-level isolation the whole merge rests on.
 *
 * Measured on the real tsconfig program: injecting `import { canvasCountFor } from
 * '@/webgl/sceneRegistry'` into a file under src/ yields 0 errors and resolves into
 * welcome/. That is why this is a test and not a typecheck concern.
 *
 * Deliberately NOT covered here, because vue-tsc already catches it: the `number` vs
 * `NodeJS.Timeout` divergence that `types: ["node"]` introduces. A bare
 * `const t: number = setTimeout(...)` is a TS2322 at typecheck time, so re-asserting it
 * would only duplicate the compiler — and the clone's `ReturnType<typeof setInterval>`
 * idiom is a legitimate second answer to the same problem, not a violation.
 */
const ROOT = fileURLToPath(new URL('../', import.meta.url))

const sources = (dir) => {
  const abs = path.join(ROOT, dir)
  if (!fs.existsSync(abs)) return []
  const out = []
  ;(function walk(d) {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name)
      if (e.isDirectory()) walk(p)
      else if (/\.(ts|vue)$/.test(e.name)) out.push(p)
    }
  })(abs)
  return out
}

const SCAN = { src: sources('src'), welcome: sources('welcome') }

// Every spelling that reaches the @ alias. `from '@/…'` alone is blind to dynamic
// import(), and the clone itself uses that form for 16 of its route components —
// so a `from`-only guard would miss 18 of 117 real alias usages.
// All patterns carry `g`: String.matchAll throws on a non-global RegExp.
const ALIAS_FORMS = [
  /from\s*['"]@\//g,
  /import\(\s*['"]@\//g,
  /export\s+\*\s+from\s*['"]@\//g,
  /import\s+['"]@\//g,
]

// Side-effect imports (`import '../x'`), bare specifiers and the dynamic form all count,
// so these mirror ALIAS_FORMS rather than only matching `from`. Direction-specific:
// src is forbidden to reach welcome and vice versa; a `../src/` inside src is merely odd.
const REACH_WELCOME = [
  /from\s*['"](?:\.\.\/)+welcome\//g,
  /import\s+['"](?:\.\.\/)+welcome\//g,
  /import\(\s*['"](?:\.\.\/)+welcome\//g,
]
const REACH_SRC = [
  /from\s*['"](?:\.\.\/)+src\//g,
  /import\s+['"](?:\.\.\/)+src\//g,
  /import\(\s*['"](?:\.\.\/)+src\//g,
]
const CROSS_ENTRY = [...REACH_WELCOME, ...REACH_SRC]

const NODE_ONLY = [
  /from\s*['"]node:/g,
  /import\(\s*['"]node:/g,
  /\bBuffer\./g,
  /\bprocess\.env\b/g,
]

const offenders = (files, patterns) => {
  const hits = []
  for (const f of files) {
    const text = fs.readFileSync(f, 'utf8')
    for (const re of patterns) {
      re.lastIndex = 0
      for (const m of text.matchAll(re)) hits.push(`${path.relative(ROOT, f)}: ${m[0].trim()}`)
    }
  }
  return hits
}

test('the main app never reaches the clone through the shared @ alias', () => {
  assert.deepEqual(offenders(SCAN.src, ALIAS_FORMS), [],
    'tsconfig paths and vite.config resolve.alias both map "@" to welcome/, so these '
    + 'imports silently load clone code from the app entry and break document-level '
    + 'isolation. Use a relative path inside src/, or move the shared piece into shared/.')
})

test('neither entry traverses into the other by relative path', () => {
  assert.deepEqual(offenders(SCAN.src, REACH_WELCOME), [], 'src/ must not import out of its own entry into welcome/')
  assert.deepEqual(offenders(SCAN.welcome, REACH_SRC), [], 'welcome/ must not import out of its own entry into src/')
})

test('browser code stays off the Node globals the shared tsconfig exposes', () => {
  const hits = offenders([...SCAN.src, ...SCAN.welcome], NODE_ONLY)
  assert.deepEqual(hits, [],
    'types:["node"] makes these resolve silently; they only fail later at bundle time. '
    + 'src/ and welcome/ are browser-only entries.')
})

test('the guards scan real files and can report a violation', () => {
  // Without this, an empty file list or a dead regex would make every test above pass vacuously.
  assert.ok(SCAN.src.length >= 10, `only ${SCAN.src.length} src files scanned`)
  assert.ok(SCAN.welcome.length >= 60, `only ${SCAN.welcome.length} welcome files scanned`)

  // The clone uses the alias heavily by design; if this is 0 the scanner is not working.
  const aliasInClone = offenders(SCAN.welcome, ALIAS_FORMS).length
  assert.ok(aliasInClone >= 60, `expected heavy @ alias use in welcome/, found ${aliasInClone}`)

  // Each guard must fire on a snippet that is bad by definition, and stay quiet on the
  // forms the codebase actually uses.
  const scan = (text, patterns) => patterns.reduce((acc, re) => {
    re.lastIndex = 0
    return acc + (re.test(text) ? 1 : 0)
  }, 0)
  assert.equal(scan("import { x } from '@/w'", ALIAS_FORMS) > 0, true, 'alias guard inert on static import')
  assert.equal(scan("await import('@/pages/Home')", ALIAS_FORMS) > 0, true, 'alias guard inert on dynamic import')
  assert.equal(scan('export * from "@/content/home"', ALIAS_FORMS) > 0, true, 'alias guard inert on re-export')
  assert.equal(scan("import { join } from 'node:path'", NODE_ONLY) > 0, true, 'node guard inert')
  assert.equal(scan("import '../welcome/webgl/x'", CROSS_ENTRY) > 0, true, 'cross-entry guard inert')
  // Legitimate forms must NOT fire.
  assert.equal(scan("import { api } from './api'", ALIAS_FORMS), 0, 'alias guard fires on a relative import')
  assert.equal(scan("import { session } from './session'", CROSS_ENTRY), 0, 'cross-entry guard overfits')
})
