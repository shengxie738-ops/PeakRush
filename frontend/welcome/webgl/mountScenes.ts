/**
 * mountScenes.ts — owns "get a captured scene onto its canvas, reliably".
 *
 * WHY THIS FILE EXISTS (the `live=0` bug, measured):
 * `src/app/App.vue` registers scenes exactly once, inside its own `onMounted`, after
 * `await import('@/motion/createMotionRuntime')`. Every route in `src/app/router.ts` is
 * a lazy `() => import('@/pages/HomePage.vue')`, so at that moment the section
 * components have not been created yet: `document.querySelector('[data-section-id=…]')`
 * returns null for all three built scenes, `mountFor()` returns null, the loop
 * `continue`s and nothing throws. Probe evidence: the WEBGL_SECTIONS iteration runs at
 * +135ms while the hero section only reaches the DOM later, and `canvasCountFor()` is
 * never called from `mountFor()` (only from the section setups). Result: canvases=6,
 * live=0.
 *
 * The fix lives on the WebGL side so it cannot regress: mounts are discovered with a
 * MutationObserver plus a bounded retry, so it does not matter whether the canvas
 * exists at App-onMounted time, one frame later, or after a route change.
 *
 * CLOCK CONTRACT (see INTEGRATION_REQUESTS.md):
 *   • `mountWebGLScenes(runtime)` / `attachMotionRuntime(runtime)` — preferred. The
 *     single-clock motion runtime drives and resizes the scenes.
 *   • `ensureWebGLAutoMount()` — the safety net App.vue does not have to know about. It
 *     renders with a *presentation-only* loop: it never creates a second Lenis and never
 *     writes scroll, it only READS `container.scrollTop` (which the app's Lenis owns)
 *     plus a pointer listener. One scroll authority, one render tick.
 *   Both paths share one registry, so adopting the helper in App.vue just hands the
 *   scenes over; nothing ever renders twice.
 */
import type { FrameInput, MotionRuntime, SceneController, ScrollRange, SectionId } from '@/motion/motion.types';
import { MOUNT_SPEC_BY_SCENE, WEBGL_SECTIONS, createWebGLScene, type WebGLMount } from './sceneRegistry';

export interface DiscoveredMount {
  sectionId: SectionId;
  sceneName: string;
  section: HTMLElement;
  host: HTMLElement;
  canvases: HTMLCanvasElement[];
}

export interface MountedScene {
  sectionId: SectionId;
  scene: SceneController;
  host: HTMLElement;
  section: HTMLElement;
  canvases: HTMLCanvasElement[];
  range: ScrollRange;
  /** True once the scene has taken over its placeholder DOM. */
  live: boolean;
}

export interface MountOptions {
  /** Scroll container; defaults to `.scrollable__area`. */
  container?: HTMLElement | null;
  /** Called instead of the built-in live signal (so a component can own it). */
  onLive?: (sectionId: SectionId, host: HTMLElement) => void;
  /** Stop retrying after this many ms (default 10s — slow route chunks included). */
  timeoutMs?: number;
  /** Set false for runtime-only mode (never start the presentation-only loop). */
  allowFallbackDriver?: boolean;
}

interface Entry {
  mounted: MountedScene;
  /** True when a MotionRuntime drives this scene. */
  claimed: boolean;
}

const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v);
const entries = new Map<SectionId, Entry>();
const pending = new Set<SectionId>();
let opts: MountOptions = {};
let runtime: MotionRuntime | null = null;
let observer: MutationObserver | null = null;
let retryTimer: ReturnType<typeof setInterval> | null = null;
let deadline = 0;
let driver: PresentationDriver | null = null;
let autoStarted = false;

/** Scroll container of the clone (reference: `DIV.scrollable__area.lenis`). */
export function scrollContainer(): HTMLElement | null {
  if (typeof document === 'undefined') return null;
  return document.querySelector<HTMLElement>('.scrollable__area') ?? document.documentElement;
}

/**
 * Scroll range for one section — the same derivation App.vue uses: progress 0 when the
 * section top sits one viewport below the fold, 1 when it has travelled one viewport
 * past the top.
 */
export function scrollRangeFor(element: HTMLElement, container: HTMLElement): ScrollRange {
  const top = element.getBoundingClientRect().top + container.scrollTop;
  const span = container.clientHeight || (typeof window !== 'undefined' ? window.innerHeight : 1) || 1;
  return { startPx: Math.max(0, top - span), endPx: top + span };
}

/** Every captured section whose host element and canvases are currently in the DOM. */
export function discoverMounts(): DiscoveredMount[] {
  if (typeof document === 'undefined') return [];
  const found: DiscoveredMount[] = [];
  for (const meta of WEBGL_SECTIONS) {
    if (!meta.built) continue;
    const spec = MOUNT_SPEC_BY_SCENE[meta.sceneName];
    if (!spec) continue;
    const section = document.querySelector<HTMLElement>('[data-section-id="' + meta.sectionId + '"]');
    if (!section) continue;
    const host = section.querySelector<HTMLElement>(spec.selector);
    if (!host) continue;
    const canvases = Array.from(host.querySelectorAll('canvas')) as HTMLCanvasElement[];
    if (canvases.length === 0 || canvases.length < meta.canvasCount) continue;
    found.push({ sectionId: meta.sectionId, sceneName: meta.sceneName, section, host, canvases });
  }
  return found;
}

function hostSize(el: HTMLElement): { w: number; h: number } {
  const rect = typeof el.getBoundingClientRect === 'function' ? el.getBoundingClientRect() : null;
  return {
    w: Math.round((rect?.width || el.clientWidth || (typeof window !== 'undefined' ? window.innerWidth : 1)) || 1),
    h: Math.round((rect?.height || el.clientHeight || (typeof window !== 'undefined' ? window.innerHeight : 1)) || 1),
  };
}

/**
 * The mount must be a box the canvas can fill.
 *
 * The reference CSS for the hero (`Landing1IntroWebGl.DZK6hbZ4.css`) is
 *   .landing-1-intro-webgl canvas, .landing-1-intro-webgl__canvas-wrapper {
 *     top:0;right:0;bottom:0;left:0;position:absolute }
 *   .landing-1-intro-webgl canvas:first-child { z-index:-1 }
 * i.e. the wrapper is taken out of flow and stretched over the section layer, and the
 * first canvas (the far depth layer) is pushed behind the section content. App.vue's
 * CLONE-LOCAL style currently pins the wrapper to `position: relative` instead, which
 * collapses it to 0px because its only children are absolutely positioned canvases —
 * the hero then renders into a full-size buffer that is displayed at 1440×0.
 *
 * Restoring the measured placement inline on the mount element (never on a component
 * this layer does not own) keeps the canvas visible; see INTEGRATION_REQUESTS.md §2 for
 * the one-line style-block change that makes this redundant.
 */
function ensureHostBox(host: HTMLElement, canvases: readonly HTMLCanvasElement[]): void {
  if (typeof host.getBoundingClientRect !== 'function' || typeof getComputedStyle !== 'function') return;
  const rect = host.getBoundingClientRect();
  if (rect.width < 1 || rect.height < 1) {
    host.style.position = 'absolute';
    host.style.inset = '0';
  }
  // Far layer behind the section content, near layer on top (reference rule above).
  const first = canvases[0];
  if (first && getComputedStyle(first).zIndex === 'auto') first.style.zIndex = '-1';
}

function devicePixelRatio(): number {
  return typeof window === 'undefined' ? 1 : Math.min(window.devicePixelRatio || 1, 2);
}

/** Mark the placeholder DOM as taken over by the renderer. */
function signalLive(entry: Entry): void {
  const mounted = entry.mounted;
  if (mounted.live) return;
  mounted.live = true;
  if (opts.onLive) {
    opts.onLive(mounted.sectionId, mounted.host);
    return;
  }
  mounted.host.setAttribute('data-webgl', 'live');
  // The section components keep a static poster inside the host until they are told the
  // scene is up. They own that flag; until they are wired to this module it is hidden
  // here so the canvas is actually visible (see INTEGRATION_REQUESTS.md §1).
  for (const poster of Array.from(mounted.host.querySelectorAll<HTMLElement>('.webgl-fallback'))) {
    poster.style.display = 'none';
  }
}

function buildMount(kind: WebGLMount['kind'], canvases: HTMLCanvasElement[]): WebGLMount | null {
  if (kind === 'card-ring') {
    if (canvases.length < 2) return null;
    return { kind: 'card-ring', canvases: [canvases[0], canvases[1]] };
  }
  if (!canvases.length) return null;
  /* Every other mount shape is one canvas. This must pass `kind` through verbatim:
     an earlier revision re-narrowed it to curved-panel/pointer-panel, which silently
     dropped every scene added afterwards (testimonials and connectory requested no
     WebGL context at all and left their canvases blank). */
  return { kind, canvas: canvases[0] } as WebGLMount;
}

function mountOne(discovery: DiscoveredMount): Entry | null {
  const spec = MOUNT_SPEC_BY_SCENE[discovery.sceneName];
  const mount = buildMount(spec.kind, discovery.canvases);
  if (!mount) return null;
  const scene = createWebGLScene(discovery.sectionId, mount);
  if (!scene) return null;
  const container = opts.container ?? scrollContainer();
  ensureHostBox(discovery.host, discovery.canvases);
  const { w, h } = hostSize(discovery.host);
  const mounted: MountedScene = {
    sectionId: discovery.sectionId,
    scene,
    host: discovery.host,
    section: discovery.section,
    canvases: discovery.canvases,
    range: container ? scrollRangeFor(discovery.section, container) : { startPx: 0, endPx: 1 },
    live: false,
  };
  scene.resize(w, h, devicePixelRatio());
  const entry: Entry = { mounted, claimed: false };
  if (runtime) {
    runtime.register(scene, mounted.range);
    entry.claimed = true;
  }
  entries.set(discovery.sectionId, entry);
  pending.delete(discovery.sectionId);
  return entry;
}

/** Attempt every still-unmounted section. Returns true when nothing is left pending. */
export function tryMountPending(): boolean {
  for (const discovery of discoverMounts()) {
    if (entries.has(discovery.sectionId)) continue;
    const entry = mountOne(discovery);
    if (entry && !entry.claimed) driver?.start();
    if (entry) {
      if (typeof requestAnimationFrame === 'function') requestAnimationFrame(() => signalLive(entry));
      else signalLive(entry);
    }
  }
  pending.clear();
  for (const meta of WEBGL_SECTIONS) {
    if (meta.built && !entries.has(meta.sectionId)) pending.add(meta.sectionId);
  }
  return pending.size === 0;
}

/**
 * Presentation-only loop for scenes no MotionRuntime claimed. It never instantiates
 * Lenis and never writes scroll: it reads `container.scrollTop`, which the app's single
 * Lenis instance animates.
 */
class PresentationDriver {
  private raf = 0;
  private startAt = 0;
  /**
   * Capture-only clock pin. `?heroTimeSec=<n>` freezes `frame.timeSec` so a screenshot can be
   * taken at a known animation phase. Without it the hero ring is at a different rotation in
   * every capture (it advances -0.05 turns/s), which makes a pixel diff against a still
   * reference frame meaningless — the phase, not the geometry, dominates the delta.
   */
  private readonly frozenTimeSec: number | null =
    typeof location === 'undefined'
      ? null
      : (() => {
          const raw = new URLSearchParams(location.search).get('heroTimeSec');
          if (raw === null) return null;
          const n = Number(raw);
          return Number.isFinite(n) ? n : null;
        })();
  private lastAt = 0;
  private container: HTMLElement | null = null;
  private pointer = { x: 0, y: 0 };
  private reduce: MediaQueryList | null = null;
  private readonly frame: FrameInput = {
    timeSec: 0,
    deltaSec: 1 / 60,
    scrollYPx: 0,
    velocityPxPerSec: 0,
    pointerNdc: { x: 0, y: 0 },
    viewport: { width: 0, height: 0, dpr: 1 },
    reducedMotion: false,
  };

  start(): void {
    if (this.raf || typeof window === 'undefined') return;
    this.bind(opts.container ?? scrollContainer());
    this.startAt = typeof performance !== 'undefined' ? performance.now() : Date.now();
    this.lastAt = this.startAt;
    this.raf = requestAnimationFrame(this.tick);
  }

  private bind(container: HTMLElement | null): void {
    if (this.container === container) return;
    this.unbind();
    this.container = container;
    if (!container) return;
    container.addEventListener('pointermove', this.onPointer, { passive: true });
    window.addEventListener('resize', this.onResize);
    if (typeof window.matchMedia === 'function') {
      this.reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
      this.reduce.addEventListener?.('change', this.onResize);
    }
  }

  private unbind(): void {
    this.container?.removeEventListener('pointermove', this.onPointer);
    if (typeof window !== 'undefined') window.removeEventListener('resize', this.onResize);
    this.reduce?.removeEventListener?.('change', this.onResize);
    this.container = null;
  }

  private readonly onPointer = (event: PointerEvent): void => {
    const container = this.container;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    this.pointer.x = ((event.clientX - rect.left) / Math.max(1, rect.width)) * 2 - 1;
    this.pointer.y = 1 - ((event.clientY - rect.top) / Math.max(1, rect.height)) * 2;
  };

  private readonly onResize = (): void => {
    for (const entry of entries.values()) {
      if (entry.claimed) continue;
      ensureHostBox(entry.mounted.host, entry.mounted.canvases);
      const { w, h } = hostSize(entry.mounted.host);
      entry.mounted.scene.resize(w, h, devicePixelRatio());
      const container = opts.container ?? scrollContainer();
      if (container) entry.mounted.range = scrollRangeFor(entry.mounted.section, container);
    }
  };

  private readonly tick = (now: number): void => {
    this.raf = requestAnimationFrame(this.tick);
    this.onResizeIfIdle();
    const container = this.container;
    if (!container) return;
    const frame = this.frame;
    frame.timeSec = this.frozenTimeSec ?? (now - this.startAt) / 1000;
    frame.deltaSec = Math.min(0.05, Math.max(1 / 240, (now - this.lastAt) / 1000));
    this.lastAt = now;
    frame.scrollYPx = container.scrollTop;
    frame.velocityPxPerSec = 0;
    frame.pointerNdc.x = this.pointer.x;
    frame.pointerNdc.y = this.pointer.y;
    frame.viewport.width = container.clientWidth;
    frame.viewport.height = container.clientHeight;
    frame.viewport.dpr = devicePixelRatio();
    frame.reducedMotion = this.reduce?.matches ?? false;

    for (const entry of entries.values()) {
      if (entry.claimed) continue;
      const { mounted } = entry;
      const span = mounted.range.endPx - mounted.range.startPx;
      const progress = span > 0 ? clamp01((frame.scrollYPx - mounted.range.startPx) / span) : 0;
      mounted.scene.update(frame, progress);
      if (!mounted.live) signalLive(entry);
    }
    // Reduced motion: one static frame is the whole animation.
    if (frame.reducedMotion) this.stop();
  };

  /** Re-measure the host rects when the layout changed without a window resize. */
  private lastLayoutCheck = 0;
  private onResizeIfIdle(): void {
    if (this.lastAt - this.lastLayoutCheck < 500) return;
    this.lastLayoutCheck = this.lastAt;
    this.onResize();
  }

  stop(): void {
    if (this.raf && typeof window !== 'undefined') cancelAnimationFrame(this.raf);
    this.raf = 0;
    this.unbind();
  }
}

function watch(): void {
  if (typeof document === 'undefined') return;
  deadline = (typeof performance !== 'undefined' ? performance.now() : Date.now()) + (opts.timeoutMs ?? 10_000);
  if (!observer && typeof MutationObserver !== 'undefined') {
    observer = new MutationObserver(() => {
      if (tryMountPending()) stopWatching();
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });
  }
  if (!retryTimer) {
    retryTimer = setInterval(() => {
      const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
      if (tryMountPending() || now > deadline) stopWatching();
    }, 64);
  }
}

function stopWatching(): void {
  observer?.disconnect();
  observer = null;
  if (retryTimer !== null) clearInterval(retryTimer);
  retryTimer = null;
}

/**
 * Mount every captured scene. Pass the motion runtime to let the single clock drive
 * them; omit it to fall back to the presentation-only loop.
 */
export function mountWebGLScenes(motion?: MotionRuntime | null, options: MountOptions = {}): MountedScene[] {
  opts = { ...opts, ...options };
  if (motion) runtime = motion;
  if (!driver && opts.allowFallbackDriver !== false) driver = new PresentationDriver();
  if (motion) claimAll(motion);
  const done = tryMountPending();
  if (!done) watch();
  return [...entries.values()].map((e) => e.mounted);
}

function claimAll(motion: MotionRuntime): void {
  for (const entry of entries.values()) {
    if (entry.claimed) continue;
    motion.register(entry.mounted.scene, entry.mounted.range);
    entry.claimed = true;
  }
}

/** Hand the scenes to a motion runtime created later than the mounts. */
export function attachMotionRuntime(motion: MotionRuntime, options: MountOptions = {}): MountedScene[] {
  opts = { ...opts, ...options };
  runtime = motion;
  claimAll(motion);
  driver?.stop();
  return [...entries.values()].map((e) => e.mounted);
}

/**
 * Idempotent auto-mount, armed from `sceneRegistry` module scope so it is listening
 * before any section exists. Opt out with `window.__FOLLOW_WEBGL_NO_AUTOMOUNT__ = true`.
 */
export function ensureWebGLAutoMount(options: MountOptions = {}): void {
  /* `sceneRegistry` imports this module and is imported by it, so this function can be
     reached while this module body has not finished evaluating. Touch no module state
     synchronously — everything below runs a microtask later. */
  void Promise.resolve().then(() => {
    if (autoStarted || typeof window === 'undefined' || typeof document === 'undefined') return;
    if ((window as unknown as Record<string, unknown>).__FOLLOW_WEBGL_NO_AUTOMOUNT__) return;
    autoStarted = true;
    opts = { ...opts, ...options };
    if (!driver) driver = new PresentationDriver();
    const arm = (): void => {
      if (!tryMountPending()) watch();
    };
    /* App.vue already refuses to build a runtime under prefers-reduced-motion, but it is
       not the only mount path: this auto-mount arms from a module side-effect, so it
       mounted all five scenes anyway and allocated six WebGL contexts before the
       PresentationDriver's own reduced-motion check (which only stops the loop) ever
       ran. Suppression has to happen before the contexts exist. If the user flips the
       setting at runtime, arm on the next change. */
    const reduce = typeof window.matchMedia === 'function'
      ? window.matchMedia('(prefers-reduced-motion: reduce)')
      : null;
    if (reduce?.matches) {
      const onChange = (): void => {
        if (reduce.matches) return;
        reduce.removeEventListener('change', onChange);
        arm();
      };
      reduce.addEventListener('change', onChange);
      return;
    }
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => requestAnimationFrame(arm), { once: true });
    } else {
      requestAnimationFrame(arm);
    }
  });
}

/** Unmount + dispose every scene and stop every listener (route teardown, tests). */
export function disposeWebGLScenes(): void {
  stopWatching();
  driver?.stop();
  driver = null;
  for (const [id, entry] of entries) {
    if (entry.claimed && runtime) runtime.unregister(id);
    else entry.mounted.scene.dispose();
  }
  entries.clear();
  pending.clear();
  runtime = null;
  autoStarted = false;
}

/** Introspection for the test bridge / diagnostics. */
export function webGLMountState(): {
  mounted: SectionId[];
  pending: SectionId[];
  live: SectionId[];
  claimed: SectionId[];
} {
  const mounted: SectionId[] = [];
  const live: SectionId[] = [];
  const claimed: SectionId[] = [];
  for (const [id, entry] of entries) {
    mounted.push(id);
    if (entry.mounted.live) live.push(id);
    if (entry.claimed) claimed.push(id);
  }
  return { mounted, pending: [...pending], live, claimed };
}
