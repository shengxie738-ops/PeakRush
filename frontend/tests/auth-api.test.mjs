import { beforeEach, test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import ts from 'typescript'

const source = await fs.readFile(new URL('../welcome/app/authApi.ts', import.meta.url), 'utf8')
const compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } }).outputText
const { submitAuth, AuthRequestError } = await import('data:text/javascript;base64,' + Buffer.from(compiled).toString('base64'))

const TOKEN_RESULT = { token: 'header.body.sig', user: { id: 7, username: 'admin_01', role: 'USER' } }
let sent

beforeEach(() => {
  sent = undefined
  globalThis.window = { setTimeout, clearTimeout }
})

test('signin posts to /api/auth/login with only username and password', async () => {
  globalThis.fetch = async (path, options) => {
    sent = { path, options }
    return new Response(JSON.stringify(TOKEN_RESULT))
  }
  const result = await submitAuth('signin', 'admin_01', 'longenough')
  assert.equal(sent.path, '/api/auth/login')
  assert.equal(sent.options.method, 'POST')
  assert.equal(sent.options.body, '{"username":"admin_01","password":"longenough"}')
  // A plain object literal, not a Headers instance: submitAuth has no caller-supplied
  // headers to merge, which is the only reason frontend/src/api.ts:17 builds one.
  assert.equal(sent.options.headers['Content-Type'], 'application/json')
  assert.equal(sent.options.headers['Accept'], 'application/json')
  assert.deepEqual(result, TOKEN_RESULT)
})

test('signup posts to /api/auth/register', async () => {
  globalThis.fetch = async (path, options) => {
    sent = { path, options }
    return new Response(JSON.stringify(TOKEN_RESULT))
  }
  await submitAuth('signup', 'newuser', 'longenough')
  assert.equal(sent.path, '/api/auth/register')
})

test('the username is trimmed before it is sent, matching Auth.java:29', async () => {
  globalThis.fetch = async (_path, options) => {
    sent = options
    return new Response(JSON.stringify(TOKEN_RESULT))
  }
  await submitAuth('signin', '  admin_01  ', 'longenough')
  assert.equal(sent.body, '{"username":"admin_01","password":"longenough"}')
})

test('a 401 keeps the backend message and its code', async () => {
  globalThis.fetch = async () => new Response(JSON.stringify({ code: 'INVALID_CREDENTIALS', message: '用户名或密码不正确' }), { status: 401 })
  await assert.rejects(
    () => submitAuth('signin', 'admin_01', 'wrongpassw'),
    (error) => error instanceof AuthRequestError && error.status === 401
      && error.code === 'INVALID_CREDENTIALS' && error.message === '用户名或密码不正确',
  )
})

test('a 409 duplicate username surfaces as such', async () => {
  globalThis.fetch = async () => new Response(JSON.stringify({ code: 'USERNAME_EXISTS', message: '用户名已存在' }), { status: 409 })
  await assert.rejects(
    () => submitAuth('signup', 'admin_01', 'longenough'),
    (error) => error instanceof AuthRequestError && error.status === 409 && error.code === 'USERNAME_EXISTS',
  )
})

test('a 400 validation rejection carries the backend wording, not a locally invented one', async () => {
  globalThis.fetch = async () => new Response(JSON.stringify({ code: 'BAD_REQUEST', message: '用户名须为3–40位字母数字下划线，密码须为8–72字节' }), { status: 400 })
  await assert.rejects(
    () => submitAuth('signup', 'x', 'short'),
    (error) => error.message === '用户名须为3–40位字母数字下划线，密码须为8–72字节',
  )
})

test('a network failure is reported as such and never mistaken for a rejection', async () => {
  globalThis.fetch = async () => { throw new TypeError('network unavailable') }
  await assert.rejects(
    () => submitAuth('signin', 'admin_01', 'longenough'),
    (error) => error instanceof AuthRequestError && error.status === 0 && error.code === 'NETWORK_ERROR',
  )
})

test('a timeout aborts at 18s and says it is safe to retry', async () => {
  let seenMs
  // The stub runs the callback synchronously, so the implementation's real
  // controller.abort() has already fired by the time fetch is called. That reproduces
  // the state an 18s stall produces instead of faking an 'abort' event by hand —
  // a synthetic dispatchEvent would leave signal.aborted false and test nothing.
  globalThis.window = { setTimeout: (fn, ms) => { seenMs = ms; fn(); return 1 }, clearTimeout: () => {} }
  const abortError = () => Object.assign(new Error('The operation was aborted.'), { name: 'AbortError' })
  globalThis.fetch = (_path, options) => options.signal.aborted
    ? Promise.reject(abortError())
    : new Promise((_resolve, reject) => { options.signal.addEventListener('abort', () => reject(abortError())) })
  await assert.rejects(
    () => submitAuth('signin', 'admin_01', 'longenough'),
    (error) => error instanceof AuthRequestError && error.code === 'TIMEOUT' && error.status === 0,
  )
  assert.equal(seenMs, 18000)
})

test('a 200 carrying HTML instead of JSON is rejected, not treated as a login', async () => {
  globalThis.fetch = async () => new Response('<html>proxy response</html>', { status: 200 })
  await assert.rejects(
    () => submitAuth('signin', 'admin_01', 'longenough'),
    (error) => error instanceof AuthRequestError && error.code === 'INVALID_RESPONSE',
  )
})

test('a 503 gets an actionable message', async () => {
  globalThis.fetch = async () => new Response('{}', { status: 503 })
  await assert.rejects(
    () => submitAuth('signin', 'admin_01', 'longenough'),
    (error) => error instanceof AuthRequestError && error.status === 503,
  )
})
