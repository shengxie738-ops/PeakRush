/**
 * @vitest-environment jsdom
 *
 * Requirement 3 of the WebGL brief: `update(frame, progress)` must be a PURE function
 * of (timeSec, progress, pointerNdc) — no per-frame accumulation anywhere in a scene.
 * Each call is proven by re-applying the same input after an unrelated one and comparing
 * the full object state (object matrices + camera + the uniforms the shaders read).
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { muteWebglLogs, stubCanvasContext } from './webgl-test-harness';
import type { FrameInput } from '@/motion/motion.types';
import { createCardRing, type CardRingController } from '@/webgl/createCardRing';
import { createCurvedPanel, type CurvedPanelController } from '@/webgl/createCurvedPanel';
import { createPointerPanel, type PointerPanelController } from '@/webgl/createPointerPanel';

/* three.js asks the canvas for a WebGL context; jsdom has none, so the host goes
   `dead` and rendering is a no-op — which is exactly the path that must still apply
   scene state (the purity contract is independent of the GPU). */
let restore: () => void = () => undefined;
beforeEach(() => {
  stubCanvasContext();
  restore = muteWebglLogs();
});
afterEach(() => restore());

function makeCanvases(n: number): HTMLCanvasElement[] {
  return Array.from({ length: n }, () => document.createElement('canvas'));
}

function frame(over: Partial<FrameInput> = {}): FrameInput {
  return {
    timeSec: 3.7,
    deltaSec: 1 / 60,
    scrollYPx: 120,
    velocityPxPerSec: 0,
    pointerNdc: { x: 0.2, y: -0.3 },
    viewport: { width: 1440, height: 900, dpr: 1 },
    reducedMotion: false,
    ...over,
  };
}

/** A structurally identical but freshly allocated FrameInput. */
function sameFrameDifferentIdentity(f: FrameInput): FrameInput {
  return {
    timeSec: f.timeSec,
    deltaSec: f.deltaSec,
    scrollYPx: f.scrollYPx,
    velocityPxPerSec: f.velocityPxPerSec,
    pointerNdc: { x: f.pointerNdc.x, y: f.pointerNdc.y },
    viewport: { width: f.viewport.width, height: f.viewport.height, dpr: f.viewport.dpr },
    reducedMotion: f.reducedMotion,
  };
}

const DISTURBING = [
  frame({ timeSec: 41.25, scrollYPx: 4200, pointerNdc: { x: -0.9, y: 0.77 } }),
  frame({ timeSec: 0, scrollYPx: 0, pointerNdc: { x: 0, y: 0 } }),
  frame({ timeSec: 7.125, scrollYPx: 999, reducedMotion: true, pointerNdc: { x: 0.5, y: -1 } }),
];

describe('card ring (home.hero) update purity', () => {
  let scene: CardRingController;
  beforeEach(() => {
    const [a, b] = makeCanvases(2);
    scene = createCardRing({ canvases: [a, b] }) as CardRingController;
    scene.resize(1440, 900, 1);
  });

  it('returns identical state for the same FrameInput called twice', () => {
    const input = frame();
    scene.update(input, 0.4);
    const first = scene.snapshot();
    scene.update(sameFrameDifferentIdentity(input), 0.4);
    expect(scene.snapshot()).toEqual(first);
  });

  it('returns to the same state after unrelated frames (no accumulation)', () => {
    const input = frame();
    scene.update(input, 0.4);
    const reference = scene.snapshot();
    for (const disturb of DISTURBING) {
      scene.update(disturb, 0.9);
      scene.update(disturb, 0);
      scene.update(input, 0.4);
      expect(scene.snapshot()).toEqual(reference);
    }
  });

  it('keeps every card mesh at an identity transform (the ring lives in the shader)', () => {
    scene.update(frame(), 0.5);
    const identity = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
    for (const m of scene.snapshot().meshMatrices) expect(m).toEqual(identity);
  });

  it('derives the ring phase from timeSec, not from a running total', () => {
    scene.update(frame({ timeSec: 20 }), 0);
    const a = scene.snapshot().pathOffsets;
    scene.update(frame({ timeSec: 40 }), 0);
    const b = scene.snapshot().pathOffsets;
    // -0.05 turns/s (the reference's `deltaTime * -5e-5`) → exactly one revolution per
    // 20 s, so 20 extra seconds advances every card by exactly one full turn.
    expect(b).toHaveLength(a.length);
    for (let i = 0; i < a.length; i++) expect(b[i]).toBeCloseTo(a[i] - 1, 9);
    // …and a scene rebuilt from scratch lands on the same numbers: nothing is summed.
    const [x, y] = makeCanvases(2);
    const fresh = createCardRing({ canvases: [x, y] }) as CardRingController;
    fresh.update(frame({ timeSec: 40 }), 0);
    expect(fresh.snapshot().pathOffsets).toEqual(b);
  });
});

describe('curved panel (home.card) update purity', () => {
  let scene: CurvedPanelController;
  beforeEach(() => {
    scene = createCurvedPanel({ canvas: makeCanvases(1)[0] }) as CurvedPanelController;
    scene.resize(1032, 826, 1);
  });

  it('is a pure function of (progress, pointerNdc)', () => {
    const input = frame();
    scene.update(input, 0.42);
    const reference = scene.snapshot();
    expect(reference.cameraPosition).toHaveLength(3);
    for (const disturb of DISTURBING) {
      scene.update(disturb, 0.05);
      scene.update(input, 0.42);
    }
    expect(scene.snapshot()).toEqual(reference);
  });

  it('moves the camera with the pointer and nothing else', () => {
    scene.update(frame({ pointerNdc: { x: -0.4012, y: -0.542 } }), 0.5);
    const measured = scene.snapshot();
    scene.update(frame({ pointerNdc: { x: 0.9, y: 0.9 } }), 0.5);
    const moved = scene.snapshot();
    expect(moved.cameraPosition).not.toEqual(measured.cameraPosition);
    scene.update(frame({ pointerNdc: { x: -0.4012, y: -0.542 } }), 0.5);
    expect(scene.snapshot()).toEqual(measured);
  });
});

describe('pointer panel (home.get-seen) update purity', () => {
  let scene: PointerPanelController;
  beforeEach(() => {
    scene = createPointerPanel({ canvas: makeCanvases(1)[0] }) as PointerPanelController;
    scene.resize(584, 686, 1);
  });

  it('is a pure function of (progress, pointerNdc)', () => {
    const input = frame();
    scene.update(input, 0.6);
    const reference = scene.snapshot();
    for (const disturb of DISTURBING) {
      scene.update(disturb, 0.1);
      scene.update(input, 0.6);
    }
    expect(scene.snapshot()).toEqual(reference);
  });

  it('zeroes the mouse influence under prefers-reduced-motion', () => {
    scene.update(frame({ reducedMotion: true, pointerNdc: { x: 0.8, y: -0.4 } }), 0.3);
    expect(scene.snapshot().mousePos).toEqual([0, 0]);
  });
});
