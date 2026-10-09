import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import ts from 'typescript'
import { compileScript, compileTemplate, parse } from '@vue/compiler-sfc'
import { createRenderer, h, nextTick, reactive } from 'vue'
import * as THREE from 'three'

// Execute the application's TS and SFC setup code, replacing only browser/GPU
// boundaries. Three geometry, materials, scene controllers and Vue reactivity stay real.
export async function welcomeHarness({ reduced = false, failRenderer = false, delayImport = false } = {}) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'peakrush-welcome-'))
  const sourceRoot = process.env.PEAKRUSH_WELCOME_SOURCE
    ? pathToFileURL(path.resolve(process.env.PEAKRUSH_WELCOME_SOURCE) + path.sep)
    : new URL('../../welcome/', import.meta.url)
  class Element {
    constructor(tag = 'div', width = 400, height = 200) {
      this.tagName = tag.toUpperCase(); this.clientWidth = width; this.clientHeight = height
      this.scrollTop = 0; this.scrollHeight = 3000; this.top = 0; this.left = 0
      this.children = []; this.parentElement = null; this.style = {}; this.attributes = new Map(); this.listeners = new Map()
      this.classList = { add() {}, remove() {} }
    }
    get firstElementChild() { return this.children[0] }
    getBoundingClientRect() { return { width: this.clientWidth, height: this.clientHeight, top: this.top, left: this.left } }
    addEventListener(type, fn) { if (!this.listeners.has(type)) this.listeners.set(type, new Set()); this.listeners.get(type).add(fn) }
    removeEventListener(type, fn) { this.listeners.get(type)?.delete(fn) }
    dispatchEvent(event) { for (const fn of [...(this.listeners.get(event.type) ?? [])]) fn(event); if (event.bubbles) this.parentElement?.dispatchEvent(event); return true }
    setAttribute(name, value) { this.attributes.set(name, String(value)) }
    getAttribute(name) { return this.attributes.get(name) ?? null }
    hasAttribute(name) { return this.attributes.has(name) }
    removeAttribute(name) { this.attributes.delete(name) }
    getContext() { return { fillRect() {} } }
    scrollTo({ top }) { this.scrollTop = top }
    matchesSelector(selector) { return selector.startsWith('.') ? (this.getAttribute('class') ?? '').split(' ').includes(selector.slice(1)) : selector === '[data-carousel-step]' ? this.hasAttribute('data-carousel-step') : this.tagName === selector.toUpperCase() }
    closest(selector) { return selector.split(', ').some(part => this.matchesSelector(part)) ? this : this.parentElement?.closest(selector) ?? null }
    querySelector(selector) { return this.matches?.[selector] ?? this.querySelectorAll(selector)[0] ?? null }
    querySelectorAll(selector) { return selector === '.webgl-fallback' && this.posters ? this.posters : this.children.flatMap(el => [...(el.matchesSelector(selector) ? [el] : []), ...el.querySelectorAll(selector)]) }
  }
  const container = new Element('div', 1200, 800)
  const sections = new Map(), renderers = new Set(), requests = [], lenisInstances = []
  const rafs = new Map(), timers = new Map(), observers = new Set()
  let serial = 0, now = 0
  const media = new Element(); media.matches = reduced
  const route = reactive({ name: 'home', meta: {} })
  const browser = new Element()
  Object.assign(browser, { innerWidth: 1200, innerHeight: 800, devicePixelRatio: 1, matchMedia: () => media,
    requestAnimationFrame: fn => { const id = ++serial; rafs.set(id, fn); return id }, cancelAnimationFrame: id => rafs.delete(id) })
  const doc = new Element()
  Object.assign(doc, { readyState: 'complete', visibilityState: 'visible', documentElement: new Element(),
    createElement: tag => new Element(tag), querySelector: selector => selector === '.scrollable__area' ? container : sections.get(selector.match(/data-section-id="([^"]+)"/)?.[1]) ?? null,
    querySelectorAll: selector => selector === 'canvas' ? [...sections.values()].flatMap(s => s.host.children) : [] })
  const originals = new Map()
  const setGlobal = (key, value) => { originals.set(key, Object.getOwnPropertyDescriptor(globalThis, key)); Object.defineProperty(globalThis, key, { value, writable: true, configurable: true }) }
  setGlobal('window', browser); setGlobal('document', doc); setGlobal('location', { search: '' })
  setGlobal('requestAnimationFrame', browser.requestAnimationFrame); setGlobal('cancelAnimationFrame', browser.cancelAnimationFrame)
  setGlobal('getComputedStyle', () => ({ zIndex: 'auto' }))
  setGlobal('setInterval', fn => { const id = ++serial; timers.set(id, fn); return id }); setGlobal('clearInterval', id => timers.delete(id))
  setGlobal('MutationObserver', class { constructor(fn) { this.fn = fn } observe() { observers.add(this) } disconnect() { observers.delete(this) } })
  setGlobal('IntersectionObserver', class { observe() {} disconnect() {} })
  if (!globalThis.CustomEvent) setGlobal('CustomEvent', class extends Event { constructor(type, options = {}) { super(type, options); this.detail = options.detail } })
  let releaseImport
  const gate = delayImport ? new Promise(resolve => { releaseImport = resolve }) : Promise.resolve()
  const boundary = {
    THREE, route, gate,
    Renderer: class {
      constructor({ canvas }) { if (failRenderer) throw new Error('WebGL unavailable'); this.canvas = canvas; this.width = 0; this.height = 0; this.frames = 0; renderers.add(this) }
      setClearColor() {} setPixelRatio() {} setViewport() {} setScissorTest() {} setScissor() {}
      setSize(width, height) { this.width = width; this.height = height }
      getSize(v) { return v.set(this.width, this.height) }
      render() { this.frames++ }
      dispose() { renderers.delete(this) }
      getContext() { return { isContextLost: () => false, getExtension: () => ({ loseContext() {} }) } }
    },
    TextureLoader: class { load(url, onLoad, _progress, onError) { const texture = new THREE.Texture(); requests.push({ url, texture, succeed: () => { texture.image = { width: 64, height: 64 }; onLoad(texture) }, fail: onError }); return texture } },
    Lenis: class {
      constructor(options) { this.options = options; this.isStopped = false; this.scroll = options.wrapper.scrollTop; lenisInstances.push(this) }
      stop() { this.isStopped = true } start() { this.isStopped = false } resize() {} raf() {}
      scrollTo(top) { if (typeof top === 'number') this.options.wrapper.scrollTop = this.scroll = top }
      destroy() { lenisInstances.splice(lenisInstances.indexOf(this), 1) }
    },
  }
  const boundaryKey = '__peakrushWelcomeHarness' + Date.now() + Math.random()
  setGlobal(boundaryKey, boundary)
  const output = rel => path.join(dir, rel.replace(/\.(ts|vue)$/, '.mjs'))
  const stub = path.join(dir, 'stub.mjs')
  await fs.writeFile(stub, 'export default {};')
  await fs.writeFile(path.join(dir, 'three.mjs'), `export * from ${JSON.stringify(import.meta.resolve('three'))}; export const WebGLRenderer = globalThis[${JSON.stringify(boundaryKey)}].Renderer; export const TextureLoader = globalThis[${JSON.stringify(boundaryKey)}].TextureLoader;`)
  await fs.writeFile(path.join(dir, 'lenis.mjs'), `export default globalThis[${JSON.stringify(boundaryKey)}].Lenis;`)
  await fs.writeFile(path.join(dir, 'router.mjs'), `export { RouterLink } from ${JSON.stringify(import.meta.resolve('vue-router'))}; export const useRoute = () => globalThis[${JSON.stringify(boundaryKey)}].route;`)
  await fs.writeFile(path.join(dir, 'motionGate.mjs'), `await globalThis[${JSON.stringify(boundaryKey)}].gate; export { createMotionRuntime } from './motion/createMotionRuntime.mjs';`)
  const pending = new Set()
  async function compile(rel) {
    if (pending.has(rel)) return
    pending.add(rel)
    let text = await fs.readFile(new URL(rel, sourceRoot), 'utf8')
    if (rel.endsWith('.vue')) {
      const descriptor = parse(text).descriptor
      const script = compileScript(descriptor, { id: 'test-' + rel })
      text = script.content
      if (rel === 'features/home/HomeTestimonials.vue' || rel === 'components/BrushLink.vue') {
        const template = compileTemplate({ source: descriptor.template.content, filename: rel, id: 'test-' + rel, compilerOptions: { bindingMetadata: script.bindings } })
        if (template.errors.length) throw new Error(template.errors.join('\n'))
        text = text.replace('export default ', 'const __component = ') + '\n' + template.code + '\n__component.render = render; export default __component;'
      }
    }
    let js = ts.transpileModule(text, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } }).outputText
    const matches = [...js.matchAll(/(?:from\s*|import\s*\()(['"])([^'"]+)\1/g)]
    for (const match of matches) {
      const spec = match[2]
      let target
      if (spec === 'three' || spec === 'lenis') target = path.join(dir, spec + '.mjs')
      else if (spec === 'vue') target = import.meta.resolve('vue')
      else if (spec === 'vue-router') target = path.join(dir, 'router.mjs')
      else if (spec.startsWith('.') || spec.startsWith('@/')) {
        let dependency = spec.startsWith('@/') ? spec.slice(2) : path.posix.join(path.posix.dirname(rel), spec)
        if (dependency.endsWith('.vue') && !['app/App.vue', 'features/home/HomeTestimonials.vue', 'components/BrushLink.vue'].includes(dependency)) target = stub
        else if (rel === 'app/App.vue' && spec === '@/motion/createMotionRuntime') { target = path.join(dir, 'motionGate.mjs'); await compile('motion/createMotionRuntime.ts') }
        else if (dependency.includes('?raw') || dependency.endsWith('.json')) {
          const content = await fs.readFile(new URL(dependency.replace('?raw', ''), sourceRoot), 'utf8')
          target = 'data:text/javascript;base64,' + Buffer.from('export default ' + (dependency.endsWith('.json') ? content : JSON.stringify(content))).toString('base64')
        } else { dependency += path.posix.extname(dependency) ? '' : '.ts'; target = output(dependency); await compile(dependency) }
      } else throw new Error('Unmapped dependency: ' + spec)
      js = js.replaceAll(JSON.stringify(spec), JSON.stringify(target.startsWith('file:') || target.startsWith('data:') ? target : pathToFileURL(target).href))
      js = js.replaceAll("'" + spec + "'", JSON.stringify(target.startsWith('file:') || target.startsWith('data:') ? target : pathToFileURL(target).href))
    }
    await fs.mkdir(path.dirname(output(rel)), { recursive: true }); await fs.writeFile(output(rel), js)
  }
  const load = async rel => { await compile(rel); return import(pathToFileURL(output(rel)).href) }
  const addSection = (id = 'home.get-seen', width = 400, height = 200) => {
    const host = new Element('div', width, height), section = new Element('section', width, height)
    const specs = { 'home.hero': '.landing-1-intro-webgl__canvas-wrapper', 'home.get-seen': '.landing-2-get-seen-webgl', 'home.card': '.landing-5-nexus-webgl__content', 'home.connectory': '.landing-7-connectory-webgl', 'home.testimonials': '.landing-9-testimonials-webgl' }
    host.children = Array.from({ length: id === 'home.hero' ? 2 : 1 }, () => { const canvas = new Element('canvas'); canvas.parentElement = host; return canvas })
    host.posters = [new Element('img')]; section.host = host; section.matches = { [specs[id]]: host }; sections.set(id, section)
    for (const observer of [...observers]) observer.fn([])
    return { section, host, canvas: host.children[0], poster: host.posters[0] }
  }
  const frame = () => { now += 16; const work = [...rafs.values()]; rafs.clear(); for (const fn of work) fn(now) }
  const flush = async () => { for (let i = 0; i < 10; i++) { await nextTick(); await new Promise(resolve => setImmediate(resolve)) } }
  const mountApp = async () => {
    const { default: App } = await load('app/App.vue')
    App.render = function () { return h('div', { ref: 'scrollArea' }) }
    const renderer = createRenderer({ createElement: () => container, insert() {}, remove() {}, createText: () => new Element(), createComment: () => new Element(), setText() {}, setElementText() {}, parentNode: () => null, nextSibling: () => null, patchProp() {} })
    const app = renderer.createApp(App); app.mount(new Element()); await flush(); return app
  }
  const mountTestimonials = async () => {
    const { default: Component } = await load('features/home/HomeTestimonials.vue')
    const renderer = createRenderer({
      createElement: tag => new Element(tag), createText: text => Object.assign(new Element('#text'), { text }), createComment: () => new Element('#comment'),
      insert(child, parent, anchor) { if (child.parentElement) child.parentElement.children.splice(child.parentElement.children.indexOf(child), 1); child.parentElement = parent; const at = anchor ? parent.children.indexOf(anchor) : -1; parent.children.splice(at < 0 ? parent.children.length : at, 0, child) },
      remove(child) { child.parentElement?.children.splice(child.parentElement.children.indexOf(child), 1) },
      setText(el, text) { el.text = text }, setElementText(el, text) { el.text = text; el.children = [] }, parentNode: el => el.parentElement, nextSibling: el => el.parentElement?.children[el.parentElement.children.indexOf(el) + 1] ?? null,
      patchProp(el, key, previous, next) {
        if (/^on[A-Z]/.test(key)) { const event = key[2].toLowerCase() + key.slice(3); if (previous) el.removeEventListener(event, previous); if (next) el.addEventListener(event, next) }
        else if (key === 'style') Object.assign(el.style, next)
        else if (next === undefined || next === null || next === false) el.removeAttribute(key)
        else el.setAttribute(key, next)
      },
    })
    const app = renderer.createApp(Component); app.config.warnHandler = () => {}; const root = new Element(); app.mount(root); await flush()
    const host = root.querySelector('.landing-9-testimonials-webgl')
    return { app, host, canvas: host.querySelector('canvas'), buttons: host.querySelectorAll('button') }
  }
  const clean = async () => {
    if (pending.has('webgl/mountScenes.ts')) (await load('webgl/mountScenes.ts')).disposeWebGLScenes()
    if (pending.has('webgl/textureRegistry.ts')) (await load('webgl/textureRegistry.ts')).textureRegistry.disposeAll()
    for (const [key, descriptor] of originals) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete globalThis[key] }
    await fs.rm(dir, { recursive: true, force: true })
  }
  return { load, addSection, sections, container, route, browser, doc, media, renderers, requests, lenisInstances, rafs, timers, observers, Element, frame, flush, mountApp, mountTestimonials, releaseImport: () => releaseImport?.(), clean }
}
