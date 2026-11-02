import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

/**
 * Guards the premise of the portal merge: the clone site's CSS and source were moved
 * with ZERO path edits because every asset URL is root-absolute and publicDir is the
 * shared root. If one asset goes missing, an <img> 404s silently — no console error,
 * page looks plausible. Task 5's audit proved this once by hand; this keeps it proved.
 */
const PUBROOT = fileURLToPath(new URL('../public/', import.meta.url))
const WELROOT = fileURLToPath(new URL('../welcome/', import.meta.url))
const has = (p) => fs.existsSync(PUBROOT + p)

const files = []
;(function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name)
    if (e.isDirectory()) walk(p)
    else if (/\.(vue|ts|css|json|glsl)$/.test(e.name)) files.push(p)
  }
})(WELROOT)

// Block /* */ , // and <!-- --> so comment prose cannot be mistaken for a reference.
const maskComments = (src) =>
  src
    .replace(/\/\*[\s\S]*?\*\//g, (m) => ' '.repeat(m.length))
    .replace(/<!--[\s\S]*?-->/g, (m) => ' '.repeat(m.length))
    .replace(/(^|[^:\\)'"])\/\/[^\n]*/g, (m, p1) => p1 + ' ')

// Greedy, and deliberately stops at `$ { ' " ) , space` so an interpolated path is
// collected as its stem (e.g. `/assets/cards/Card-`) rather than as a fake file.
const FILE_LIKE = /\.[a-z0-9]+$/i

const collect = (src) => {
  const out = new Set()
  const code = maskComments(src)
  for (const m of code.matchAll(/\/(?:assets|fonts)\/[^\s'"`)${},]+|\/icons\.svg/g)) {
    const t = m[0]
    // Only real files are asserted here. Base constants (`/assets/subpages/about/`)
    // and interpolation stems (`/assets/cards/Card-`) are covered by the range tests.
    if (FILE_LIKE.test(t)) out.add(t)
  }
  return out
}

const scanned = new Map()
for (const f of files) for (const t of collect(fs.readFileSync(f, 'utf8'))) {
  if (!scanned.has(t)) scanned.set(t, path.relative(WELROOT, f))
}

test('every static root-absolute asset URL in welcome/ resolves under public/', () => {
  const missing = [...scanned.entries()].filter(([t]) => !has(t))
  assert.deepEqual(missing, [], `${missing.length} unresolved asset path(s)`)
})

test('the scanner is actually finding asset paths, not spinning green on an empty set', () => {
  // A guard that matches nothing is indistinguishable from a passing guard.
  assert.ok(scanned.size >= 100, `only ${scanned.size} asset paths found — scanner regressed`)
  for (const probe of ['/assets/cards/Card-1.png', '/fonts/HeadingNow-73Book.woff2', '/icons.svg']) {
    assert.ok(scanned.has(probe), `expected to discover ${probe}`)
  }
  assert.equal(has('/assets/cards/Card-1.png'), true)
  assert.equal(has('/assets/definitely-not-here.png'), false, 'has() must be able to report a miss')
})

// Three families are built by string interpolation, so the static scan skips them.
// Each has one fixed range, pinned here with the source that decides it.
const DYNAMIC = [
  { dir: '/assets/cards/', prefix: 'Card-', count: 9, suffix: '.png', why: 'webgl/createCardRing.ts:151 cardCount default 9; content/home.ts:68' },
  { dir: '/assets/decor/', prefix: 'Review-', count: 8, suffix: '.png', why: 'webgl/createTestimonialCarousel.ts:129 default 8; sceneRegistry.ts:100 count:8' },
  { dir: '/assets/people/', prefix: 'trail-', count: 18, suffix: '.png', why: 'content/subpages/product.ts:215 trailOrder max 18' },
]
for (const fam of DYNAMIC) {
  test(`${fam.dir}${fam.prefix}1..${fam.count} all exist`, () => {
    const absent = []
    for (let i = 1; i <= fam.count; i++) if (!has(`${fam.dir}${fam.prefix}${i}${fam.suffix}`)) absent.push(`${fam.prefix}${i}${fam.suffix}`)
    assert.deepEqual(absent, [], `missing generated asset(s); range justified by ${fam.why}`)
  })
}
