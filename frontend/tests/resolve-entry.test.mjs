import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import ts from 'typescript'

const source = await fs.readFile(new URL('../build/resolve-entry.ts', import.meta.url), 'utf8')
const compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } }).outputText
const { resolveEntry } = await import('data:text/javascript;base64,' + Buffer.from(compiled).toString('base64'))

const HTML = 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'

test('clone routes fall back to the clone entry', () => {
  for (const p of ['/', '/about', '/our-product', '/pricing', '/faq', '/community-board',
                   '/signin', '/signup', '/gift-card', '/terms-and-conditions',
                   '/privacy-policy', '/cookies-policy', '/no-such-page']) {
    assert.equal(resolveEntry(p, HTML), '/index.html', p)
  }
})

test('main app routes fall back to the app entry, with or without trailing slash', () => {
  for (const p of ['/app', '/app/', '/app/orders', '/app/admin', '/app/activities/12',
                   '/app/no-such-page']) {
    assert.equal(resolveEntry(p, HTML), '/app.html', p)
  }
})

test('a path that merely starts with the letters app is not an app route', () => {
  assert.equal(resolveEntry('/application', HTML), '/index.html')
  assert.equal(resolveEntry('/app-evil', HTML), '/index.html')
  assert.equal(resolveEntry('/apple/orders', HTML), '/index.html')
})

test('static and internal prefixes are never rewritten', () => {
  for (const p of ['/assets/cards/Card-1.png', '/assets/product-earbuds.png',
                   '/fonts/HeadingNow-73Book.woff2', '/icons.svg',
                   '/welcome/main.ts', '/src/main.ts', '/_app/index-abc123.js',
                   '/api/auth/login', '/actuator/health',
                   '/@vite/client', '/@id/__x00__plugin-vue:export-helper',
                   '/node_modules/vue/dist/vue.js',
                   '/index.html', '/app.html']) {
    assert.equal(resolveEntry(p, HTML), null, p)
  }
})

test('anything containing a dot in its last segment is treated as a file', () => {
  assert.equal(resolveEntry('/favicon.ico', HTML), null)
  assert.equal(resolveEntry('/about/team.photo', HTML), null)
})

test('non-html requests are never rewritten, whatever the path', () => {
  assert.equal(resolveEntry('/about', 'application/json'), null)
  assert.equal(resolveEntry('/app/orders', '*/*'), null)
  assert.equal(resolveEntry('/signin', undefined), null)
  assert.equal(resolveEntry('/signin', ''), null)
})
