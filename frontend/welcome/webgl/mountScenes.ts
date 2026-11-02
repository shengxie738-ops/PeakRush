/** App owns activation; this registry owns each host/canvas and its fallback. */
import type { FrameInput, MotionRuntime, SceneController, ScrollRange, SectionId } from '@/motion/motion.types';
import { MOUNT_SPEC_BY_SCENE, WEBGL_SECTIONS, createWebGLScene, type WebGLMount } from './sceneRegistry';

export interface DiscoveredMount {
  sectionId: SectionId;
  sceneName: string;
  section: HTMLElement;
  host: HTMLElement;
  canvases: HTMLCanvasElement[];
}
export interface MountedScene extends Omit<DiscoveredMount, 'sceneName'> {
  scene: SceneController;
  range: ScrollRange;
  live: boolean;
}
export interface MountOptions {
  container?: HTMLElement | null;
  onLive?: (sectionId: SectionId, host: HTMLElement) => void;
  timeoutMs?: number;
  allowFallbackDriver?: boolean;
}
interface Entry {
  mounted: MountedScene;
  driven: SceneController;
  claimed: boolean;
  onContextLost: () => void;
}
const entries = new Map<SectionId, Entry>();
const pending = new Set<SectionId>();
let opts: MountOptions = {};
let runtime: MotionRuntime | null = null;
let observer: MutationObserver | null = null;
let retryTimer: ReturnType<typeof setInterval> | null = null;
let driver: PresentationDriver | null = null;
let active = false;
const clamp01 = (v: number): number => Math.max(0, Math.min(1, v));

export function scrollContainer(): HTMLElement | null {
  return typeof document === 'undefined' ? null : document.querySelector<HTMLElement>('.scrollable__area') ?? document.documentElement;
}
export function scrollRangeFor(element: HTMLElement, container: HTMLElement): ScrollRange {
  const top = element.getBoundingClientRect().top - container.getBoundingClientRect().top + container.scrollTop;
  const span = container.clientHeight || window.innerHeight || 1;
  return { startPx: Math.max(0, top - span), endPx: top + span };
}
export function discoverMounts(): DiscoveredMount[] {
  if (typeof document === 'undefined') return [];
  const found: DiscoveredMount[] = [];
  for (const meta of WEBGL_SECTIONS) {
    if (!meta.built) continue;
    const spec = MOUNT_SPEC_BY_SCENE[meta.sceneName];
    const section = document.querySelector<HTMLElement>('[data-section-id="' + meta.sectionId + '"]');
    const host = section?.querySelector<HTMLElement>(spec.selector);
    if (!section || !host) continue;
    const canvases = Array.from(host.querySelectorAll('canvas'));
    if (canvases.length < meta.canvasCount) continue;
    found.push({ sectionId: meta.sectionId, sceneName: meta.sceneName, section, host, canvases });
  }
  return found;
}
function hostSize(host: HTMLElement): { width: number; height: number } {
  const rect = host.getBoundingClientRect();
  return { width: Math.max(1, Math.round(rect.width || host.clientWidth)), height: Math.max(1, Math.round(rect.height || host.clientHeight)) };
}
function dpr(): number { return Math.min(window.devicePixelRatio || 1, 2); }
function ensureHostBox(host: HTMLElement, canvases: HTMLCanvasElement[]): void {
  const rect = host.getBoundingClientRect();
  if (rect.width < 1 || rect.height < 1) { host.style.position = 'absolute'; host.style.inset = '0'; }
  if (canvases.length > 1 && getComputedStyle(canvases[0]).zIndex === 'auto') canvases[0].style.zIndex = '-1';
}
function setLive(entry: Entry, live: boolean): void {
  const { mounted } = entry;
  mounted.live = live;
  if (live) mounted.host.setAttribute('data-webgl', 'live');
  else mounted.host.removeAttribute('data-webgl');
  for (const poster of mounted.host.querySelectorAll<HTMLElement>('.webgl-fallback')) poster.style.display = live ? 'none' : '';
  for (const canvas of mounted.canvases) canvas.style.visibility = live ? '' : 'hidden';
}
function resizeEntry(entry: Entry, pixelRatio = dpr()): void {
  const { mounted } = entry;
  ensureHostBox(mounted.host, mounted.canvases);
  const size = hostSize(mounted.host);
  mounted.scene.resize(size.width, size.height, pixelRatio);
  const container = opts.container ?? scrollContainer();
  // Mutate the shared range so the runtime's existing registration sees layout changes.
  if (container) Object.assign(mounted.range, scrollRangeFor(mounted.section, container));
}
function disposeEntry(id: SectionId, entry: Entry): void {
  setLive(entry, false);
  for (const canvas of entry.mounted.canvases) canvas.removeEventListener('webglcontextlost', entry.onContextLost);
  if (entry.claimed && runtime) runtime.unregister(id);
  else entry.mounted.scene.dispose();
  entries.delete(id);
}
function mountOne(discovery: DiscoveredMount): Entry | null {
  const kind = MOUNT_SPEC_BY_SCENE[discovery.sceneName].kind;
  const mount = kind === 'card-ring'
    ? { kind, canvases: [discovery.canvases[0], discovery.canvases[1]] } as WebGLMount
    : { kind, canvas: discovery.canvases[0] } as WebGLMount;
  const scene = createWebGLScene(discovery.sectionId, mount);
  if (!scene) return null;
  const mounted: MountedScene = { ...discovery, scene, range: { startPx: 0, endPx: 1 }, live: false };
  let lastMeasure = -Infinity;
  const entry: Entry = {
    mounted, claimed: false, onContextLost: () => setLive(entry, false),
    driven: {
      id: scene.id,
      update(frame, progress) {
        if (frame.timeSec - lastMeasure > 0.5) { resizeEntry(entry, frame.viewport.dpr); lastMeasure = frame.timeSec; }
        scene.update(frame, progress);
        const live = scene.ready === true;
        if (mounted.live === live) return;
        setLive(entry, live);
        if (live) opts.onLive?.(mounted.sectionId, mounted.host);
      },
      resize: (...args) => scene.resize(...args),
      resizeToHost: (pixelRatio) => resizeEntry(entry, pixelRatio),
      dispose: () => { setLive(entry, false); scene.dispose(); },
    },
  };
  setLive(entry, false);
  for (const canvas of mounted.canvases) canvas.addEventListener('webglcontextlost', entry.onContextLost);
  resizeEntry(entry);
  entries.set(discovery.sectionId, entry);
  if (runtime) { runtime.register(entry.driven, mounted.range); entry.claimed = true; }
  return entry;
}
export function tryMountPending(): boolean {
  if (!active) return true;
  const discoveries = discoverMounts();
  for (const [id, entry] of entries) {
    const fresh = discoveries.find(item => item.sectionId === id);
    if (!fresh || fresh.host !== entry.mounted.host || fresh.section !== entry.mounted.section ||
      fresh.canvases.length !== entry.mounted.canvases.length || fresh.canvases.some((canvas, i) => canvas !== entry.mounted.canvases[i])) disposeEntry(id, entry);
  }
  for (const discovery of discoveries) if (!entries.has(discovery.sectionId)) mountOne(discovery);
  pending.clear();
  for (const meta of WEBGL_SECTIONS) if (meta.built && !entries.has(meta.sectionId)) pending.add(meta.sectionId);
  if (!runtime && entries.size) driver?.start();
  if (!entries.size) driver?.stop();
  return pending.size === 0;
}
class PresentationDriver {
  private raf = 0;
  private started = 0;
  private previous = 0;
  private container: HTMLElement | null = null;
  private pointer = { x: 0, y: 0 };
  private readonly onPointer = (event: PointerEvent): void => {
    const rect = this.container!.getBoundingClientRect();
    this.pointer.x = ((event.clientX - rect.left) / Math.max(1, rect.width)) * 2 - 1;
    this.pointer.y = 1 - ((event.clientY - rect.top) / Math.max(1, rect.height)) * 2;
  };
  private readonly onResize = (): void => { for (const entry of entries.values()) if (!entry.claimed) resizeEntry(entry); };
  start(): void {
    if (this.raf) return;
    this.container = opts.container ?? scrollContainer();
    if (!this.container) return;
    this.container.addEventListener('pointermove', this.onPointer, { passive: true });
    window.addEventListener('resize', this.onResize);
    this.started = performance.now(); this.previous = this.started;
    this.raf = requestAnimationFrame(this.tick);
  }
  private readonly tick = (now: number): void => {
    if (!active || !this.container) return;
    this.raf = requestAnimationFrame(this.tick);
    const container = this.container;
    const frozen = new URLSearchParams(location.search).get('heroTimeSec');
    const frame: FrameInput = {
      timeSec: frozen !== null && Number.isFinite(Number(frozen)) ? Number(frozen) : (now - this.started) / 1000,
      deltaSec: Math.max(1 / 240, Math.min(0.05, (now - this.previous) / 1000)),
      scrollYPx: container.scrollTop, velocityPxPerSec: 0, pointerNdc: this.pointer,
      viewport: { width: container.clientWidth, height: container.clientHeight, dpr: dpr() }, reducedMotion: false,
    };
    this.previous = now;
    for (const entry of entries.values()) {
      if (entry.claimed) continue;
      const range = entry.mounted.range;
      entry.driven.update(frame, clamp01((frame.scrollYPx - range.startPx) / Math.max(1, range.endPx - range.startPx)));
    }
  };
  stop(): void {
    cancelAnimationFrame(this.raf); this.raf = 0;
    this.container?.removeEventListener('pointermove', this.onPointer);
    window.removeEventListener('resize', this.onResize); this.container = null;
  }
}
function watchMounts(): void {
  if (!observer && typeof MutationObserver !== 'undefined') {
    observer = new MutationObserver(() => tryMountPending());
    observer.observe(document.documentElement, { childList: true, subtree: true });
  }
  if (retryTimer !== null) clearInterval(retryTimer);
  const deadline = performance.now() + (opts.timeoutMs ?? 10_000);
  retryTimer = setInterval(() => {
    if (tryMountPending() || performance.now() > deadline) { clearInterval(retryTimer!); retryTimer = null; }
  }, 64);
}
export function mountWebGLScenes(motion?: MotionRuntime | null, options: MountOptions = {}): MountedScene[] {
  if (runtime && motion && runtime !== motion) disposeWebGLScenes();
  active = true; opts = { ...options }; runtime = motion ?? runtime;
  if (runtime) {
    driver?.stop();
    for (const entry of entries.values()) if (!entry.claimed) { runtime.register(entry.driven, entry.mounted.range); entry.claimed = true; }
  } else if (!driver && opts.allowFallbackDriver !== false) driver = new PresentationDriver();
  tryMountPending(); watchMounts();
  return [...entries.values()].map(entry => entry.mounted);
}
export function disposeWebGLScenes(): void {
  active = false; observer?.disconnect(); observer = null;
  if (retryTimer !== null) clearInterval(retryTimer); retryTimer = null;
  driver?.stop(); driver = null;
  for (const [id, entry] of entries) disposeEntry(id, entry);
  entries.clear(); pending.clear(); runtime = null; opts = {};
}
export function webGLMountState(): { mounted: SectionId[]; pending: SectionId[]; live: SectionId[]; claimed: SectionId[] } {
  return { mounted: [...entries.keys()], pending: [...pending], live: [...entries].filter(([, entry]) => entry.mounted.live).map(([id]) => id), claimed: [...entries].filter(([, entry]) => entry.claimed).map(([id]) => id) };
}
