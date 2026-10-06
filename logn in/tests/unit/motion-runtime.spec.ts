// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createMotionRuntime } from '@/motion/createMotionRuntime';
import type { FrameInput, SceneController } from '@/motion/motion.types';

/**
 * T04 acceptance: the runtime must be the only time/scroll source, must keep
 * section progress inside its declared interval, must be frame-rate independent,
 * and must be reversible (the same scroll position always yields the same pose).
 */

class Spy implements SceneController {
  id: string;
  frames: FrameInput[] = [];
  progresses: number[] = [];
  resizes: number[] = [];
  disposed = 0;
  constructor(id: string) {
    this.id = id;
  }
  update(frame: FrameInput, progress: number) {
    this.frames.push({ ...frame, pointerNdc: { ...frame.pointerNdc }, viewport: { ...frame.viewport } });
    this.progresses.push(progress);
  }
  resize(w: number) {
    this.resizes.push(w);
  }
  dispose() {
    this.disposed++;
  }
}

function makeContainer(scrollHeight = 7563, clientHeight = 772) {
  const el = document.createElement('div');
  el.className = 'scrollable__area lenis';
  const inner = document.createElement('div');
  inner.className = 'scrollable__area-inner';
  el.appendChild(inner);
  document.body.appendChild(el);
  Object.defineProperty(el, 'clientHeight', { value: clientHeight, configurable: true });
  Object.defineProperty(el, 'scrollHeight', { value: scrollHeight, configurable: true });
  Object.defineProperty(el, 'clientWidth', { value: 1376, configurable: true });
  let top = 0;
  Object.defineProperty(el, 'scrollTop', {
    configurable: true,
    get: () => top,
    set: (v: number) => {
      top = Math.max(0, Math.min(scrollHeight - clientHeight, v));
    },
  });
  return el;
}

let container: HTMLElement;
beforeEach(() => {
  document.body.innerHTML = '';
  container = makeContainer();
});

function pump(ms: number) {
  vi.advanceTimersByTime(ms);
}

describe('motion runtime', () => {
  it('gives every registered scene exactly one FrameInput per tick', () => {
    vi.useFakeTimers();
    const runtime = createMotionRuntime({ container });
    const a = new Spy('a');
    const b = new Spy('b');
    runtime.register(a, { startPx: 0, endPx: 1000 });
    runtime.register(b, { startPx: 0, endPx: 1000 });
    runtime.setTestInput({ elapsedSec: 0.016, scrollYPx: 100 });
    pump(32);
    runtime.setTestInput({ elapsedSec: 0.032, scrollYPx: 100 });
    pump(32);
    expect(a.frames.length).toBeGreaterThan(0);
    expect(a.frames.length).toBe(b.frames.length);
    runtime.dispose();
    vi.useRealTimers();
  });

  it('keeps section progress inside the declared interval and monotonic in scroll', () => {
    vi.useFakeTimers();
    const runtime = createMotionRuntime({ container });
    const s = new Spy('s');
    runtime.register(s, { startPx: 2000, endPx: 3000 });
    for (const y of [0, 1000, 2000, 2400, 2800, 3000, 4000, 7563]) {
      runtime.setTestInput({ scrollYPx: y, elapsedSec: 0.1 });
      pump(20);
    }
    const p = s.progresses;
    expect(p.every((v) => v >= 0 && v <= 1)).toBe(true);
    for (let i = 1; i < p.length; i++) expect(p[i]).toBeGreaterThanOrEqual(p[i - 1]);
    expect(p[0]).toBe(0);
    expect(p[p.length - 1]).toBe(1);
    runtime.dispose();
    vi.useRealTimers();
  });

  it('is reversible: the same scroll position maps back to the same pose', () => {
    vi.useFakeTimers();
    const runtime = createMotionRuntime({ container });
    const s = new Spy('s');
    runtime.register(s, { startPx: 1000, endPx: 5000 });
    const forward: number[] = [];
    for (const y of [1000, 2000, 3000, 4000, 5000]) {
      runtime.setTestInput({ scrollYPx: y, elapsedSec: 1 });
      pump(20);
      forward.push(s.progresses[s.progresses.length - 1]);
    }
    const backward: number[] = [];
    for (const y of [4000, 3000, 2000, 1000]) {
      runtime.setTestInput({ scrollYPx: y, elapsedSec: 1 });
      pump(20);
      backward.push(s.progresses[s.progresses.length - 1]);
    }
    expect(backward).toEqual([forward[3], forward[2], forward[1], forward[0]]);
    runtime.dispose();
    vi.useRealTimers();
  });

  it('reaches the same damped pointer target at 30, 60 and 120 Hz', () => {
    const settle = (fps: number) => {
      vi.useRealTimers();
      vi.useFakeTimers();
      const runtime = createMotionRuntime({ container });
      const s = new Spy('s');
      runtime.register(s, { startPx: 0, endPx: 100 });
      runtime.setTestInput({ pointerNdc: { x: 1, y: 1 }, elapsedSec: 0 });
      const step = 1000 / fps;
      let t = 0;
      for (let i = 0; i < fps * 3; i++) {
        t += step / 1000;
        runtime.setTestInput({ elapsedSec: t });
        pump(step);
      }
      const last = s.frames[s.frames.length - 1].pointerNdc;
      runtime.dispose();
      return [last.x, last.y] as const;
    };
    const a = settle(30);
    const b = settle(60);
    const c = settle(120);
    for (const other of [b, c]) {
      expect(Math.abs(a[0] - other[0])).toBeLessThan(1e-6);
      expect(Math.abs(a[1] - other[1])).toBeLessThan(1e-6);
    }
    expect(a[0]).toBeGreaterThan(0.99);
    vi.useRealTimers();
  });

  it('unregisters, disposes and reports zero active scenes', () => {
    vi.useFakeTimers();
    const runtime = createMotionRuntime({ container }) as ReturnType<typeof createMotionRuntime>;
    const s = new Spy('s');
    runtime.register(s, { startPx: 0, endPx: 10 });
    pump(20);
    expect(runtime.diagnostics().activeScenes).toBe(1);
    runtime.unregister('s');
    expect(s.disposed).toBe(1);
    expect(runtime.diagnostics().activeScenes).toBe(0);
    runtime.dispose();
    const after = new Spy('after');
    runtime.register(after, { startPx: 0, endPx: 10 });
    pump(20);
    expect(after.frames.length).toBe(0);
    vi.useRealTimers();
  });
});
