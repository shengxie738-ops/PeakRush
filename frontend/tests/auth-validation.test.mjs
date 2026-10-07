import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import ts from 'typescript'

const source = await fs.readFile(new URL('../welcome/app/auth-validation.ts', import.meta.url), 'utf8')
const compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } }).outputText
const { validateCredentials, passwordByteLength } = await import('data:text/javascript;base64,' + Buffer.from(compiled).toString('base64'))

const ok = { username: 'admin_01', password: 'longenough', confirm: 'longenough' }

test('a credential pair matching Auth.java:30 produces no errors', () => {
  assert.deepEqual(validateCredentials(ok, 'signup'), {})
  assert.deepEqual(validateCredentials({ username: 'admin_01', password: 'longenough' }, 'signin'), {})
})

test('username must be 3-40 chars of letters, digits and underscore only', () => {
  for (const bad of ['ab', 'a'.repeat(41), '张三', 'a@b.com', 'a-b', 'a b', 'a.b', '']) {
    const errors = validateCredentials({ ...ok, username: bad }, 'signin')
    assert.ok(errors.username, JSON.stringify(bad) + ' should be rejected')
  }
  for (const good of ['abc', 'a_1', 'A'.repeat(40), 'user01']) {
    assert.equal(validateCredentials({ ...ok, username: good }, 'signin').username, undefined, good)
  }
})

test('an email address is rejected as a username, which is why the field is type=text', () => {
  assert.ok(validateCredentials({ ...ok, username: 'someone@example.com' }, 'signin').username)
})

test('password must be at least 8 characters, matching the backend rather than the old dialog', () => {
  assert.ok(validateCredentials({ ...ok, password: '1234567', confirm: '1234567' }, 'signup').password)
  assert.equal(validateCredentials({ ...ok, password: '12345678', confirm: '12345678' }, 'signup').password, undefined)
})

test('password is capped at 72 bytes, counted in UTF-8 not characters', () => {
  assert.equal(passwordByteLength('a'.repeat(72)), 72)
  assert.equal(passwordByteLength('a'.repeat(73)), 73)
  assert.equal(passwordByteLength('中'.repeat(24)), 72)
  assert.equal(passwordByteLength('中'.repeat(25)), 75)
  // 24 CJK chars clear the 8-character floor and sit exactly on the byte ceiling.
  assert.equal(validateCredentials({ ...ok, password: '中'.repeat(24), confirm: '中'.repeat(24) }, 'signup').password, undefined)
  assert.ok(validateCredentials({ ...ok, password: '中'.repeat(25), confirm: '中'.repeat(25) }, 'signup').password)
})

test('confirm is only checked on signup', () => {
  assert.ok(validateCredentials({ ...ok, confirm: 'mismatched' }, 'signup').confirm)
  assert.equal(validateCredentials({ username: 'admin_01', password: 'longenough' }, 'signin').confirm, undefined)
  assert.deepEqual(validateCredentials({ username: 'admin_01', password: 'longenough', confirm: 'whatever' }, 'signin'), {})
})

test('all applicable fields are reported at once, not one per submit', () => {
  const errors = validateCredentials({ username: 'x', password: 'short', confirm: 'other' }, 'signup')
  assert.deepEqual(Object.keys(errors).sort(), ['confirm', 'password', 'username'])
})

test('username is trimmed before validating, matching Auth.java:29', () => {
  assert.equal(validateCredentials({ ...ok, username: '  admin_01  ' }, 'signin').username, undefined)
})
