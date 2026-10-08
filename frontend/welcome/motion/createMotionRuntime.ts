/**
 * createMotionRuntime.ts — the single clock for the whole clone (plan §8).
 *
 * The reference ships no GSAP and no ScrollTrigger (grep across all 34 captured
 * JS chunks returns zero hits) but does ship Lenis 1.3.3 bound to
 * `DIV.scrollable__area.lenis` while `html,body` are `overflow:clip`. So the
 * runtime owns exactly one rAF loop, drives Lenis manually (`autoRaf:false`),
 * derives one normalised progress per registered scroll range, and hands every
 * scene the same immutable FrameInput. No second smoothing layer: only Lenis
 * decides how the real scroll position is followed (plan §8.3).
 */
import Lenis from 'lenis';
import type { FrameInput, MotionRuntime, SceneController, ScrollRange } from './motion.types';

export interface MotionRuntimeOptions {
  container?: HTMLElement;
  /** Lenis settle duration in ms. Reference-agnostic default; calibrate against D03/D05. */
  duration?: number;
  /** Pointer damping rate. PROPOSED — reverse-derive from the reference recordings. */
  pointerLambda?: number;
  dprCap?: number;
}

interface Registration {
  scene: SceneController;
  range: ScrollRange | null;
  lastProgress: number;
}

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

export interface RuntimeDiagnostics {
  activeScenes: number;
  canvases: number;
  ownedListeners: number;
  pendingAssets: number;
  layoutVersion: number;
  reducedMotion: boolean;
  scrollYPx: number;
}

export interface MotionRuntimeHandle extends MotionRuntime {
  diagnostics(): RuntimeDiagnostics;
}

export function createMotionRuntime(options: MotionRuntimeOptions = {}): MotionRuntimeHandle {
  const container = options.container ?? document.querySelector<HTMLElement>('.scrollable__area');
  if (!container) throw new Error('[motion] no .scrollable__area container to bind');

  const reduceQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
  let reducedMotion = reduceQuery.matches;

  const lenis = new Lenis({
    wrapper: container,
    content: container.firstElementChild ?? container,
    autoRaf: false,
    anchors: false,
    duration: options.duration ?? 1.15,
    easing: (t: number) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
    wheelMultiplier: 1,
    touchMultiplier: 2,
  });

  const registrations = new Map<string, Registration>();
  const pointerTarget = { x: 0, y: 0 };
  const pointer = { x: 0, y: 0 };
  const pointerLambda = options.pointerLambda ?? 8;
  const dprCap = options.dprCap ?? 2;

  let rafId = 0;
  let lastTime = 0;
  let elapsed = 0;
  let disposed = false;
  let ownedListeners = 0;
  let layoutVersion = 0;
  let testScroll: number | null = null;
  let testElapsed: number | null = null;
  let testPointer: { x: number; y: number } | null = null;

  const frame: FrameInput = {
    timeSec: 0,
    deltaSec: 0,
    scrollYPx: 0,
    velocityPxPerSec: 0,
    pointerNdc: pointer,
    viewport: { width: 0, height: 0, dpr: 1 },
    reducedMotion,
  };

  function readScroll(): number {
    if (testScroll !== null) return testScroll;
    return reducedMotion ? container!.scrollTop : (lenis.scroll as number);
  }

  function onPointerMove(event: PointerEvent): void {
    const rect = container!.getBoundingClientRect();
    pointerTarget.x = ((event.clientX - rect.left) / Math.max(1, rect.width)) * 2 - 1;
    pointerTarget.y = 1 - ((event.clientY - rect.top) / Math.max(1, rect.height)) * 2;
  }
  container.addEventListener('pointermove', onPointerMove, { passive: true });
  ownedListeners++;

  function onResize(): void {
    layoutVersion++;
    const w = container!.clientWidth;
    const h = container!.clientHeight;
    const dpr = Math.min(window.devicePixelRatio || 1, dprCap);
    for (const reg of registrations.values()) reg.scene.resize(w, h, dpr);
  }
  window.addEventListener('resize', onResize);
  ownedListeners++;

  const onMotionChange = (): void => {
    reducedMotion = reduceQuery.matches;
    frame.reducedMotion = reducedMotion;
    if (reducedMotion) lenis.stop();
    else lenis.start();
  };
  if (typeof reduceQuery.addEventListener === 'function') {
    reduceQuery.addEventListener('change', onMotionChange);
    ownedListeners++;
  }
  if (reducedMotion) lenis.stop();

  let previousScroll = 0;

  function tick(now: number): void {
    if (disposed) return;
    rafId = requestAnimationFrame(tick);
    if (testElapsed !== null) {
      elapsed = testElapsed;
    } else {
      if (!lastTime) lastTime = now;
      const deltaSec = Math.min(0.05, (now - lastTime) / 1000);
      lastTime = now;
      elapsed += deltaSec;
    }
    if (!reducedMotion && testScroll === null) lenis.raf(now);

    const scroll = readScroll();
    const deltaSec = Math.max(0, elapsed - frame.timeSec) || 1 / 60;
    const velocity = (scroll - previousScroll) / Math.max(1e-4, elapsed - (frame.timeSec - deltaSec));
    previousScroll = scroll;

    const alpha = reducedMotion ? 1 : 1 - Math.exp(-pointerLambda * deltaSec);
    const target = testPointer ?? pointerTarget;
    pointer.x += (target.x - pointer.x) * alpha;
    pointer.y += (target.y - pointer.y) * alpha;

    const w = container!.clientWidth;
    const h = container!.clientHeight;
    frame.timeSec = elapsed;
    frame.deltaSec = deltaSec;
    frame.scrollYPx = scroll;
    frame.velocityPxPerSec = Number.isFinite(velocity) ? velocity : 0;
    frame.pointerNdc = pointer;
    frame.viewport.width = w;
    frame.viewport.height = h;
    frame.viewport.dpr = Math.min(window.devicePixelRatio || 1, dprCap);
    frame.reducedMotion = reducedMotion;

    for (const reg of registrations.values()) {
      let progress = reg.lastProgress;
      if (reg.range) {
        const span = reg.range.endPx - reg.range.startPx;
        progress = span > 0 ? clamp01((scroll - reg.range.startPx) / span) : 0;
        reg.lastProgress = progress;
      }
      reg.scene.update(frame, progress);
    }
  }

  rafId = requestAnimationFrame(tick);
  onResize();

  return {
    register(scene, range) {
      if (disposed) return;
      registrations.set(scene.id, { scene, range: range ?? null, lastProgress: 0 });
      const rect = container!.clientWidth;
      scene.resize(rect, container!.clientHeight, Math.min(window.devicePixelRatio || 1, dprCap));
    },
    unregister(id) {
      const reg = registrations.get(id);
      if (!reg) return;
      registrations.delete(id);
      reg.scene.dispose();
    },
    scrollTo(target, offset = 0) {
      if (disposed) return;
      const wasStopped = lenis.isStopped;
      // Cancel wheel inertia even when the target already equals the position.
      lenis.stop();
      // The stopped class clips overflow, so restore scrolling before positioning.
      lenis.start();
      // Routes can change the content height before ResizeObserver has fired.
      lenis.resize();
      lenis.scrollTo(target, { offset, immediate: true, force: true });
      if (wasStopped) lenis.stop();
    },
    setTestInput(input) {
      if (typeof input.scrollYPx === 'number') {
        testScroll = input.scrollYPx;
        lenis.scrollTo(input.scrollYPx, { immediate: true, force: true } as never);
      }
      if (typeof input.elapsedSec === 'number') {
        testElapsed = input.elapsedSec;
        lastTime = 0;
      }
      if (input.pointerNdc) testPointer = { x: input.pointerNdc.x, y: input.pointerNdc.y };
      if (typeof input.reducedMotion === 'boolean') {
        reducedMotion = input.reducedMotion;
        if (reducedMotion) lenis.stop();
        else lenis.start();
      }
    },
    diagnostics() {
      return {
        activeScenes: registrations.size,
        canvases: document.querySelectorAll('canvas').length,
        ownedListeners,
        pendingAssets: 0,
        layoutVersion,
        reducedMotion,
        scrollYPx: readScroll(),
      };
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      cancelAnimationFrame(rafId);
      container.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('resize', onResize);
      if (typeof reduceQuery.removeEventListener === 'function') {
        reduceQuery.removeEventListener('change', onMotionChange);
      }
      for (const reg of registrations.values()) reg.scene.dispose();
      registrations.clear();
      ownedListeners = 0;
      lenis.destroy();
    },
  };
}

/** Diagnostics consumed by the test bridge. `ownedListeners` is what this runtime
 *  registered itself, not a browser-wide count; `pendingAssets` is owned by the
 *  texture registry and reported there, so it stays 0 until the bridge merges it. */
