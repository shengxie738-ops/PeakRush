import { test } from 'node:test'
import assert from 'node:assert/strict'
import { welcomeHarness } from './helpers/welcome-harness.mjs'

for (const initiallyReduced of [true, false]) test(`reduced motion ${initiallyReduced ? 'at startup' : 'after a change'} leaves native wheel scrolling unlocked`, async t => {
  const env = await welcomeHarness({ reduced: initiallyReduced })
  const runtime = (await env.load('motion/createMotionRuntime.ts')).createMotionRuntime({ container: env.container }); t.after(async () => { runtime.dispose(); await env.clean() })
  if (!initiallyReduced) { env.media.matches = true; env.media.dispatchEvent(new Event('change')) }
  const lenis = env.lenisInstances[0]
  assert.equal(lenis.isStopped, false)
  assert.equal(lenis.options.smoothWheel, false)
  runtime.scrollTo(500); assert.equal(env.container.scrollTop, 500); assert.equal(lenis.isStopped, false)
  env.media.matches = false; env.media.dispatchEvent(new Event('change'))
  assert.equal(lenis.isStopped, false); assert.equal(lenis.options.smoothWheel, true)
})
