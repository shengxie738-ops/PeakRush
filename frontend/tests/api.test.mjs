import { beforeEach, test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import ts from 'typescript'

// Exercise the real transport module without contacting any external service.
const source = await fs.readFile(new URL('../src/api.ts', import.meta.url), 'utf8')
const compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } }).outputText
const { api, post, ApiError } = await import('data:text/javascript;base64,' + Buffer.from(compiled).toString('base64'))
let events
let storage
beforeEach(() => {
  events = []
  storage = new Map([['peakrush.token', 'test-local-token']])
  globalThis.localStorage = { getItem: key => storage.get(key) ?? null }
  globalThis.window = { setTimeout, clearTimeout, dispatchEvent: event => { events.push(event.type); return true } }
})

test('authenticated purchase keeps the caller supplied idempotency identity and quantity', async () => {
  let sent
  globalThis.fetch = async (path, options) => { sent = { path, options }; return new Response(JSON.stringify({ requestId: 'request-one', status: 'PENDING' })) }
  const response = await post('/api/seckill/path/1/2', { quantity: 2 }, { 'Idempotency-Key': 'same-key-on-retry' })
  assert.equal(response.status, 'PENDING')
  assert.equal(sent.options.headers.get('Authorization'), 'Bearer test-local-token')
  assert.equal(sent.options.headers.get('Idempotency-Key'), 'same-key-on-retry')
  assert.equal(sent.options.body, '{"quantity":2}')
})

test('network ambiguity is reported to the caller; transport never retries a purchase itself', async () => {
  let calls = 0
  globalThis.fetch = async () => { calls++; throw new TypeError('network unavailable') }
  await assert.rejects(() => post('/api/seckill/path/1/2', { quantity: 1 }), error => error instanceof ApiError && error.status === 0)
  assert.equal(calls, 1)
})

test('an invalid success response is rejected rather than treated as an accepted order', async () => {
  globalThis.fetch = async () => new Response('<html>proxy response</html>', { status: 200 })
  await assert.rejects(() => api('/api/seckill/result/request-one'), error => error instanceof ApiError && error.code === 'INVALID_RESPONSE')
})

test('a business rejection preserves its code and is not an authentication failure', async () => {
  globalThis.fetch = async () => new Response(JSON.stringify({ code: 'RATE_LIMITED', message: '请稍后再试' }), { status: 429 })
  await assert.rejects(() => post('/api/seckill/path/1/2'), error => error.code === 'RATE_LIMITED' && error.status === 429 && error.message === '请稍后再试')
  assert.deepEqual(events, [])
})

test('expired protected-session response opens reauthentication', async () => {
  globalThis.fetch = async () => new Response('{}', { status: 401 })
  await assert.rejects(() => api('/api/orders'), error => error.status === 401)
  assert.deepEqual(events, ['peakrush:expired'])
})

test('wrong login credentials do not expire another active session through the transport', async () => {
  globalThis.fetch = async () => new Response(JSON.stringify({ code: 'BAD_CREDENTIALS' }), { status: 401 })
  await assert.rejects(() => post('/api/auth/login', { username: 'test', password: 'incorrect' }), error => error.status === 401)
  assert.deepEqual(events, [])
})

test('server failure propagates an actionable error, and never invents success data', async () => {
  globalThis.fetch = async () => new Response(JSON.stringify({ code: 'REDIS_UNAVAILABLE', message: '抢购服务暂不可用' }), { status: 503 })
  await assert.rejects(() => post('/api/seckill/path/1/2'), error => error.status === 503 && error.code === 'REDIS_UNAVAILABLE')
})
