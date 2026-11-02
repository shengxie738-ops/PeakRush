import { test } from 'node:test'
import assert from 'node:assert/strict'
import { welcomeHarness } from './helpers/welcome-harness.mjs'

test('importing section metadata leaves canvas ownership to the application', async t => {
  const env = await welcomeHarness(); t.after(env.clean)
  env.addSection(); await env.load('webgl/sceneRegistry.ts'); await env.flush(); env.frame()
  assert.equal(env.renderers.size, 0)
})

test('App mounts late homepage DOM once and releases route, preference and unmount resources', async t => {
  const env = await welcomeHarness(); t.after(env.clean)
  const app = await env.mountApp(); const mounts = await env.load('webgl/mountScenes.ts')
  const ids = ['home.hero', 'home.get-seen', 'home.card', 'home.testimonials', 'home.connectory']
  const first = ids.map(id => env.addSection(id)); await env.flush(); env.frame()
  assert.equal(env.renderers.size, 6)
  assert.equal(new Set([...env.renderers].map(r => r.canvas)).size, 6)
  assert.deepEqual(mounts.webGLMountState().claimed.sort(), [...ids].sort())
  for (const request of env.requests) request.succeed()
  env.frame(); assert.equal(mounts.webGLMountState().live.length, 5)
  env.route.name = 'signin'; await env.flush(); env.frame()
  assert.equal(env.renderers.size, 0)
  assert.ok(first.every(({ host }) => host.getAttribute('data-webgl') === null))
  assert.equal((await env.load('webgl/textureRegistry.ts')).textureRegistry.referenceCount(), 0)
  env.sections.clear(); const second = ids.map(id => env.addSection(id)); env.route.name = 'home'; await env.flush(); env.frame()
  assert.equal(env.renderers.size, 6)
  assert.ok([...env.renderers].every(r => second.some(({ host }) => host.children.includes(r.canvas))))
  env.media.matches = true; env.media.dispatchEvent(new Event('change')); await env.flush()
  assert.equal(env.renderers.size, 0)
  env.media.matches = false; env.media.dispatchEvent(new Event('change')); await env.flush(); env.frame()
  assert.equal(env.renderers.size, 6)
  app.unmount(); await env.flush()
  assert.equal(env.renderers.size, 0)
  assert.equal((await env.load('webgl/textureRegistry.ts')).textureRegistry.referenceCount(), 0)
  assert.equal(env.rafs.size, 0)
  assert.equal(env.timers.size, 0)
  assert.equal(env.browser.listeners.get('resize')?.size ?? 0, 0)
})

test('leaving home before the runtime import resolves invalidates that pending mount', async t => {
  const env = await welcomeHarness({ delayImport: true }); t.after(env.clean)
  env.addSection(); const app = await env.mountApp()
  env.route.name = 'signin'; await env.flush(); env.releaseImport(); await env.flush(); env.frame()
  assert.equal(env.renderers.size, 0); assert.equal(env.lenisInstances.length, 0)
  env.route.name = 'home'; await env.flush(); env.frame()
  assert.equal(env.renderers.size, 1); assert.equal(env.lenisInstances.length, 1)
  app.unmount()
})

test('unmount during a slow runtime import cannot allocate a late runtime or renderer', async t => {
  const env = await welcomeHarness({ delayImport: true }); t.after(env.clean)
  env.addSection(); const app = await env.mountApp(); app.unmount(); env.releaseImport(); await env.flush(); env.frame()
  assert.equal(env.renderers.size, 0)
  assert.equal(env.lenisInstances.length, 0)
  assert.equal(env.rafs.size, 0)
})

test('registry replaces a scene when its host and canvas identity changes', async t => {
  const env = await welcomeHarness(); t.after(env.clean)
  const first = env.addSection(); const mounts = await env.load('webgl/mountScenes.ts')
  mounts.mountWebGLScenes(); env.frame()
  const second = env.addSection(); mounts.tryMountPending(); env.frame()
  assert.equal(env.renderers.size, 1)
  assert.equal([...env.renderers][0].canvas, second.canvas)
  assert.notEqual(first.canvas, second.canvas)
})

test('runtime uses scene host dimensions and registry refreshes the existing scroll range', async t => {
  const env = await welcomeHarness()
  env.container.top = 50
  const { section, host } = env.addSection('home.get-seen', 400, 200); section.top = 1050
  const runtime = (await env.load('motion/createMotionRuntime.ts')).createMotionRuntime({ container: env.container }); t.after(async () => { runtime.dispose(); await env.clean() })
  const mounts = await env.load('webgl/mountScenes.ts'); const [mounted] = mounts.mountWebGLScenes(runtime)
  assert.deepEqual([...env.renderers].map(r => [r.width, r.height]), [[400, 200]])
  assert.deepEqual(mounted.range, { startPx: 200, endPx: 1800 })
  host.clientWidth = 300; host.clientHeight = 150; section.top = 1450
  env.browser.dispatchEvent(new Event('resize'))
  assert.deepEqual([...env.renderers].map(r => [r.width, r.height]), [[300, 150]])
  assert.deepEqual(mounted.range, { startPx: 600, endPx: 2200 })
})

for (const failure of ['renderer', 'texture']) test(`${failure} failure keeps the static poster visible`, async t => {
  const env = await welcomeHarness({ failRenderer: failure === 'renderer' }); t.after(env.clean)
  const { host, poster } = env.addSection(); const mounts = await env.load('webgl/mountScenes.ts'); mounts.mountWebGLScenes()
  if (failure === 'texture') for (const request of env.requests) request.fail()
  env.frame(); env.frame()
  assert.notEqual(host.getAttribute('data-webgl'), 'live')
  assert.notEqual(poster.style.display, 'none')
  assert.deepEqual(mounts.webGLMountState().live, [])
})

test('poster waits for loaded dependencies and an actual render then returns on context loss', async t => {
  const env = await welcomeHarness(); t.after(env.clean)
  const { host, canvas, poster } = env.addSection(); const mounts = await env.load('webgl/mountScenes.ts'); mounts.mountWebGLScenes()
  env.frame(); assert.notEqual(host.getAttribute('data-webgl'), 'live')
  for (const request of env.requests) request.succeed()
  assert.notEqual(host.getAttribute('data-webgl'), 'live')
  env.frame(); assert.equal(host.getAttribute('data-webgl'), 'live'); assert.equal(poster.style.display, 'none')
  canvas.dispatchEvent(new Event('webglcontextlost', { cancelable: true })); env.frame()
  assert.notEqual(host.getAttribute('data-webgl'), 'live'); assert.notEqual(poster.style.display, 'none')
  canvas.dispatchEvent(new Event('webglcontextrestored')); assert.notEqual(host.getAttribute('data-webgl'), 'live')
  env.frame(); assert.equal(host.getAttribute('data-webgl'), 'live')
  mounts.disposeWebGLScenes(); assert.notEqual(poster.style.display, 'none')
})

test('texture modes have independent objects and matching releases preserve the other owner', async t => {
  const env = await welcomeHarness(); t.after(env.clean)
  const { textureRegistry: textures } = await env.load('webgl/textureRegistry.ts')
  const srgb = textures.acquire('/card.webp', { colorSpace: 'srgb' }); const raw = textures.acquire('/card.webp', { colorSpace: 'none' })
  assert.notEqual(srgb, raw); assert.equal(srgb.colorSpace, 'srgb'); assert.equal(raw.colorSpace, '')
  textures.release('/card.webp', { colorSpace: 'none' })
  assert.equal(textures.acquire('/card.webp', { colorSpace: 'srgb' }), srgb)
  textures.release('/card.webp', { colorSpace: 'srgb' }); textures.release('/card.webp', { colorSpace: 'srgb' })
  assert.equal(textures.referenceCount(), 0)
})

test('carousel buttons and drag publish the selected index and rebuilding restores it', async t => {
  const env = await welcomeHarness(); t.after(env.clean)
  const { host, canvas } = env.addSection('home.testimonials', 1460, 800)
  const indices = []; host.addEventListener('peakrush:carousel-index', event => indices.push(event.detail.index))
  const { createTestimonialCarousel } = await env.load('webgl/createTestimonialCarousel.ts')
  let scene = createTestimonialCarousel({ canvas })
  const button = new env.Element('button'); button.setAttribute('data-carousel-step', 'next')
  host.dispatchEvent({ type: 'click', target: button })
  assert.equal(scene.snapshot().activeIndex, 1); assert.deepEqual(indices, [1]); assert.equal(host.getAttribute('data-webgl-index'), '1')
  canvas.dispatchEvent({ type: 'pointerdown', target: canvas, clientX: 600, pointerId: 1 }); canvas.dispatchEvent({ type: 'pointerup', target: canvas, clientX: 100, pointerId: 1 })
  assert.equal(scene.snapshot().activeIndex, 2); assert.deepEqual(indices, [1, 2])
  scene.dispose(); assert.equal(host.listeners.get('click')?.size ?? 0, 0)
  scene = createTestimonialCarousel({ canvas }); assert.equal(scene.snapshot().activeIndex, 2); scene.dispose()
})

test('actual Vue carousel buttons forward steps and drag updates their disabled state', async t => {
  const env = await welcomeHarness()
  const { app, host, canvas, buttons } = await env.mountTestimonials()
  const { createTestimonialCarousel } = await env.load('webgl/createTestimonialCarousel.ts')
  const scene = createTestimonialCarousel({ canvas }); t.after(async () => { scene.dispose(); app.unmount(); await env.clean() })
  const next = buttons[1]
  next.dispatchEvent({ type: 'click', target: next, bubbles: true, preventDefault() {} }); await env.flush()
  assert.equal(scene.snapshot().activeIndex, 1); assert.equal(host.getAttribute('data-webgl-index'), '1'); assert.equal(buttons[0].hasAttribute('disabled'), false)
  canvas.dispatchEvent({ type: 'pointerdown', target: canvas, clientX: 600, pointerId: 1 })
  canvas.dispatchEvent({ type: 'pointerup', target: canvas, clientX: -200, pointerId: 1 }); await env.flush()
  assert.equal(host.getAttribute('data-webgl-index'), '7'); assert.equal(next.hasAttribute('disabled'), true)
  next.dispatchEvent({ type: 'click', target: next, bubbles: true, preventDefault() {} }); await env.flush()
  assert.equal(scene.snapshot().activeIndex, 7)
})
