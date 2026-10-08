import { beforeEach, test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import ts from 'typescript'

const compile = source => ts.transpileModule(source, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 },
}).outputText
const moduleUrl = source => 'data:text/javascript;base64,' + Buffer.from(source).toString('base64')
const apiUrl = moduleUrl(compile(await fs.readFile(new URL('../src/api.ts', import.meta.url), 'utf8')))
const source = compile(await fs.readFile(new URL('../src/session.ts', import.meta.url), 'utf8'))
  .replace('"vue"', JSON.stringify(import.meta.resolve('vue')))
  .replace('"./api"', JSON.stringify(apiUrl))
let imports = 0
let saved, messages, navigations, listeners
const USER = { id: 7, username: 'demo', role: 'USER' }

const storage = values => ({
  getItem: key => values.get(key) ?? null,
  setItem: (key, value) => values.set(key, String(value)),
  removeItem: key => values.delete(key),
})
const loadSession = () => import(moduleUrl(source) + '#' + imports++)

beforeEach(() => {
  saved = new Map([
    ['peakrush.token', 'saved-token'],
    ['peakrush.user', JSON.stringify(USER)],
  ])
  messages = new Map()
  navigations = []
  listeners = new Map()
  globalThis.localStorage = storage(saved)
  globalThis.sessionStorage = storage(messages)
  globalThis.window = {
    setTimeout, clearTimeout,
    location: {
      pathname: '/app/orders',
      search: '?orderId=18&filter=PAID',
      hash: '#details',
      assign: url => navigations.push(url),
    },
    addEventListener: (name, listener) => listeners.set(name, listener),
    dispatchEvent: event => { listeners.get(event.type)?.(event); return true },
  }
})

test('login returns to the current business page with its query and fragment', async () => {
  const { requireLogin } = await loadSession()
  requireLogin('登录后查看订单。')
  assert.equal(navigations.length, 1)
  const target = new URL(navigations[0], 'http://localhost')
  assert.equal(target.pathname, '/signin')
  assert.equal(target.searchParams.get('redirect'), '/app/orders?orderId=18&filter=PAID#details')
})

test('login passes the business guidance to the portal in tab-local storage', async () => {
  const { requireLogin } = await loadSession()
  requireLogin('登录后即可参与本场抢购。')
  assert.equal(messages.get('peakrush.authMessage'), '登录后即可参与本场抢购。')
})

test('a protected API expiry clears the account before sending it to sign in', async () => {
  const { session } = await loadSession()
  window.dispatchEvent(new Event('peakrush:expired'))
  assert.equal(session.user, null)
  assert.equal(saved.has('peakrush.token'), false)
  assert.equal(saved.has('peakrush.user'), false)
  assert.equal(navigations.length, 1)
  assert.equal(new URL(navigations[0], 'http://localhost').searchParams.get('reason'), 'expired')
  assert.match(messages.get('peakrush.authMessage'), /登录已过期/)
})

test('expired identity validation also opens sign in instead of leaving a stale account', async () => {
  const { restoreSession, session } = await loadSession()
  globalThis.fetch = async () => new Response('{}', { status: 401 })
  await restoreSession()
  assert.equal(session.user, null)
  assert.equal(navigations.length, 1)
  assert.equal(new URL(navigations[0], 'http://localhost').searchParams.get('reason'), 'expired')
})

test('concurrent expired requests cause one navigation and retain the expiry guidance', async () => {
  const { requireLogin } = await loadSession()
  window.dispatchEvent(new Event('peakrush:expired'))
  window.dispatchEvent(new Event('peakrush:expired'))
  requireLogin()
  assert.equal(navigations.length, 1)
  assert.match(messages.get('peakrush.authMessage'), /登录已过期/)
})

test('unavailable tab storage does not prevent the sign-in navigation', async () => {
  const { requireLogin } = await loadSession()
  globalThis.sessionStorage = { setItem: () => { throw new Error('storage disabled') } }
  assert.doesNotThrow(() => requireLogin())
  assert.equal(navigations.length, 1)
})

test('returning to the business page through browser history can request login again', async () => {
  const { requireLogin } = await loadSession()
  requireLogin()
  window.dispatchEvent(new Event('pageshow'))
  requireLogin()
  assert.equal(navigations.length, 2)
})

test('a guest can browse the business pages without an automatic sign-in redirect', async () => {
  saved.delete('peakrush.token')
  const { restoreSession, session } = await loadSession()
  await restoreSession()
  assert.equal(session.user, null)
  assert.deepEqual(navigations, [])
})

test('a temporary identity-service failure keeps the existing bearer session', async () => {
  const { restoreSession, session } = await loadSession()
  globalThis.fetch = async () => new Response('{}', { status: 503 })
  await restoreSession()
  assert.equal(session.user?.id, USER.id)
  assert.equal(saved.get('peakrush.token'), 'saved-token')
  assert.deepEqual(navigations, [])
})
