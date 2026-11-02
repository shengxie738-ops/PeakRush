import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import ts from 'typescript'

const source = await fs.readFile(new URL('../src/storefront.ts', import.meta.url), 'utf8').catch(() => '')
const compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } }).outputText
const storefront = await import('data:text/javascript;base64,' + Buffer.from(compiled).toString('base64'))
const now = Date.parse('2026-10-09T04:00:00Z')
const item = (id, category) => ({ id, productId: id, name: `商品${id}`, category, totalStock: 100, availableStock: 100 })
const activity = (id, start, end, status = 'RUNNING', items = [item(id)]) => ({
  id, status, name: `场次${id}`, startTime: new Date(now + start).toISOString(), endTime: new Date(now + end).toISOString(), items,
})
const helper = name => {
  assert.equal(typeof storefront[name], 'function', `${name} must expose the real storefront behavior`)
  return storefront[name]
}

test('activity boundaries use an inclusive start and exclusive end', () => {
  const phase = helper('activityPhase')
  assert.equal(phase(activity(1, 0, 1000), now), '正在进行')
  assert.equal(phase(activity(1, -1000, 0), now), '已结束')
  assert.equal(phase(activity(1, 1000, 2000), now), '即将开始')
  assert.equal(phase(activity(1, -1000, 1000, 'PREHEATED'), now), '即将开始')
})

test('offline and ended activities cannot become live from their timestamps', () => {
  const phase = helper('activityPhase')
  assert.equal(phase(activity(1, -1000, 1000, 'OFFLINE'), now), '已下线')
  assert.equal(phase(activity(1, -1000, 1000, 'ENDED'), now), '已结束')
  assert.equal(phase(activity(1, -1000, 1000, 'SOLD_OUT'), now), '暂时售罄')
  assert.equal(phase(activity(1, -1000, 0, 'SOLD_OUT'), now), '已结束')
})

test('session sorting puts live and future sessions before latest history', () => {
  const sort = helper('sortActivities')
  const sessions = [activity(1, -5000, -4000), activity(2, 4000, 5000), activity(3, -2000, 3000), activity(4, 1000, 2000), activity(5, -2000, -1000)]
  assert.deepEqual(sort(sessions, now).map(a => a.id), [3, 4, 2, 5, 1])
  assert.deepEqual(sessions.map(a => a.id), [1, 2, 3, 4, 5], 'sorting must not mutate the API response')
})

test('an expired automatic selection moves to a live session while explicit history is retained', () => {
  const choose = helper('chooseActivity')
  const sessions = [activity(1, -2000, -1000), activity(2, 1000, 2000), activity(3, -1000, 1000)]
  assert.equal(choose(sessions, 1, now)?.id, 3)
  assert.equal(choose(sessions, 1, now, true)?.id, 1)
  assert.equal(choose(sessions, 2, now)?.id, 2, 'a selected future session remains selected')
  assert.equal(choose([], 1, now), undefined)
})

test('default catalog includes all current and future products beyond six and deduplicates current first', () => {
  const rows = helper('catalogRows')
  const sessions = [activity(3, -2000, -1000, 'RUNNING', [item(10)]), activity(2, 1000, 2000, 'RUNNING', [item(1), ...Array.from({ length: 5 }, (_, i) => item(i + 5))]), activity(1, -1000, 1000, 'RUNNING', [item(1), item(2), item(3), item(4)])]
  const result = rows(sessions, 1, true, now)
  assert.deepEqual(result.map(row => row.item.productId), [1, 2, 3, 4, 5, 6, 7, 8, 9])
  assert.equal(result[0].activity.id, 1)
})

test('expired history is excluded from all goods and is readable in an explicit session', () => {
  const rows = helper('catalogRows')
  const sessions = [activity(1, -2000, -1000)]
  assert.deepEqual(rows(sessions, 1, true, now), [])
  assert.equal(rows(sessions, 1, false, now).length, 1)
})

test('a sold out session cannot hide the same product available in another live session', () => {
  const rows = helper('catalogRows')
  const empty = { ...item(1), availableStock: 0 }
  const sessions = [activity(1, -2000, 1000, 'RUNNING', [empty]), activity(2, -1000, 2000, 'RUNNING', [item(1)])]
  assert.equal(rows(sessions, 1, true, now)[0].activity.id, 2)
  assert.equal(rows(sessions, 1, false, now)[0].activity.id, 1, 'explicit session stock must remain visible')
})

test('missing, blank, and unknown categories keep older APIs usable', () => {
  const category = helper('productCategory')
  for (const value of [undefined, null, '', '   ', 'unsupported']) assert.equal(category(item(1, value)), '其他好物')
  for (const value of ['数码影音', '居家生活', '运动户外', '旅行出行']) assert.equal(category(item(1, value)), value)
})

test('category choices count the complete deduplicated catalog in a stable order', () => {
  const categories = helper('catalogCategories')
  const rows = ['旅行出行', '数码影音', undefined, '数码影音', '居家生活'].map((category, i) => ({ activity: activity(1, -1000, 1000), item: item(i, category) }))
  assert.deepEqual(categories(rows), [
    { name: '全部好物', count: 5 }, { name: '数码影音', count: 2 }, { name: '居家生活', count: 1 }, { name: '旅行出行', count: 1 }, { name: '其他好物', count: 1 },
  ])
})

test('countdowns stop at an ended session and do not pretend a preheated session is open', () => {
  const countdown = helper('activityCountdown')
  assert.deepEqual(countdown(activity(1, 3661000, 5000000), now), ['01', '01', '01'])
  assert.deepEqual(countdown(activity(1, -1000, 1000), now), ['00', '00', '01'])
  assert.equal(countdown(activity(1, -1000, 0), now), null)
  assert.equal(countdown(activity(1, -1000, 1000, 'PREHEATED'), now), null)
})

test('advertising kickers follow product category independently of row position', () => {
  const kicker = helper('productKicker')
  assert.match(kicker(item(1, '居家生活')), /居家生活/)
  assert.match(kicker(item(2, '运动户外')), /运动户外/)
  assert.match(kicker(item(3)), /其他好物/)
  assert.doesNotMatch(kicker(item(1, '居家生活')), /好音质/)
})
