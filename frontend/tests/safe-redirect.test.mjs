import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import ts from 'typescript'

const source = await fs.readFile(new URL('../shared/safe-redirect.ts', import.meta.url), 'utf8')
const compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } }).outputText
const { safeRedirect } = await import('data:text/javascript;base64,' + Buffer.from(compiled).toString('base64'))

test('main app paths are accepted unchanged', () => {
  for (const p of ['/app', '/app/', '/app/orders', '/app/admin', '/app/activities/12',
                   '/app/orders?page=2', '/app/#top']) {
    assert.equal(safeRedirect(p), p)
  }
})

test('protocol-relative and absolute URLs are refused', () => {
  for (const p of ['//evil.com', '///evil.com', 'https://evil.com', 'http://evil.com/app/',
                   'javascript:alert(1)', 'data:text/html,x']) {
    assert.equal(safeRedirect(p), '/app/', p)
  }
})

test('paths outside the main app are refused, even though they are same-origin', () => {
  for (const p of ['/', '/signin', '/about', '/pricing', '/gift-card']) {
    assert.equal(safeRedirect(p), '/app/', p)
  }
})

test('paths that merely start with the letters app are refused', () => {
  for (const p of ['/application', '/app-evil', '/apple/orders', '/appx']) {
    assert.equal(safeRedirect(p), '/app/', p)
  }
})

test('non-string query values are refused', () => {
  assert.equal(safeRedirect(undefined), '/app/')
  assert.equal(safeRedirect(null), '/app/')
  assert.equal(safeRedirect(['a', 'b']), '/app/')
  assert.equal(safeRedirect({}), '/app/')
  assert.equal(safeRedirect(123), '/app/')
  assert.equal(safeRedirect(''), '/app/')
})

test('a custom fallback is honoured', () => {
  assert.equal(safeRedirect('//evil.com', '/app/orders'), '/app/orders')
  assert.equal(safeRedirect('/app/admin', '/app/orders'), '/app/admin')
})

test('paths that normalize out of the business app are refused', () => {
  for (const p of ['/app/../signin', '/app/../../outside', '/app/%2e%2e/signin',
                   '/app/..\\signin', '/app/\n../signin']) {
    assert.equal(safeRedirect(p), '/app/', p)
  }
})
