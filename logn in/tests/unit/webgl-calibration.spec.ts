/**
 * @vitest-environment jsdom
 *
 * The hero spine calibration, asserted against the measured constraints instead of
 * eyeballing. Numbers come from:
 *   evidence/reference/webgl-scenes.json  (geometry, camera, canvases, textures)
 *   evidence/reference/shaders/hero-summary.json (projectionMatrix per program → which
 *     program owns which depth band: m22/m23 decode to near 69/far 200 for the
 *     untextured program and near 0.1/far 69 for the USE_MAP program)
 *   evidence/reference/raw/_nuxt/CDL_IiwC.js (the curve: r = 15 circle in the XZ plane,
 *     spineOffset 161, pathSegment 1, pathOffset = index/9, spin = deltaTime * -5e-5)
 */
import { describe, expect, it } from 'vitest';
import { muteWebglLogs, stubCanvasContext } from './webgl-test-harness';
import * as THREE from 'three';
import {
  buildRingSpineFrames,
  buildSpineTextureData,
  computeCardPathParams,
  DEFAULT_RING_SPINE,
  HERO_SPINE_UNIFORMS,
  ringArcLength,
} from '@/webgl/geometry';
import { createCardRing } from '@/webgl/createCardRing';
import { WebGLHost } from '@/webgl/createWebGLHost';
import { createCurvedPanel, nexusCameraState, nexusScrollState } from '@/webgl/createCurvedPanel';
import { getSeenProgress } from '@/webgl/createPointerPanel';

const CARD_W = 9;
const CARD_H = 12.6;
const COUNT = 9;
const SPINE_LEN = ringArcLength(DEFAULT_RING_SPINE.radius, DEFAULT_RING_SPINE.arcLengthDivisions);
const NEAR_LAYER = { near: 0.1, far: 69 };

/** Mirror of the captured vertex shader for one card → world-space vertices. */
function cardWorldVertices(frames: ReturnType<typeof buildRingSpineFrames>, index: number) {
  const p = computeCardPathParams(SPINE_LEN, COUNT, index, CARD_W);
  const verts: THREE.Vector3[] = [];
  for (let gx = 0; gx <= 10; gx++) {
    for (let gy = 0; gy <= 1; gy++) {
      const x = (gx / 10) * CARD_W - CARD_W / 2;
      const y = (1 - gy) * CARD_H - CARD_H / 2;
      let mt = ((x + p.spineOffset) / p.spineLength) * p.pathSegment + p.pathOffset;
      mt = ((mt % 1) + 1) % 1; // textureStacks === 1 → rowOffset === 0
      const f = frames[Math.floor(mt * frames.length) % frames.length];
      // bend === true → xWeight === 0 → transformed = b*y + c*0 + spinePos
      verts.push(
        new THREE.Vector3(
          f.position[0] + f.b[0] * y,
          f.position[1] + f.b[1] * y,
          f.position[2] + f.b[2] * y,
        ),
      );
    }
  }
  return verts;
}

function projectRing(progress: number, W = 1376, H = 772) {
  const frames = buildRingSpineFrames(DEFAULT_RING_SPINE);
  const camera = new THREE.PerspectiveCamera(29.2518, W / H, NEAR_LAYER.near, 200);
  camera.position.set(0, -14, -70);
  camera.rotation.set(
    (-192 * Math.PI) / 180,
    0,
    (-25 * Math.PI) / 180 + (progress - 0.5) * 0.2,
  );
  camera.updateMatrixWorld(true);
  const inverse = new THREE.Matrix4().invert();
  camera.updateWorldMatrix(true, false);
  inverse.copy(camera.matrixWorld).invert();

  return Array.from({ length: COUNT }, (_, i) => {
    const verts = cardWorldVertices(frames, i);
    let insideFrame = 0;
    let onNearLayer = 0;
    let minZ = Infinity;
    let maxZ = -Infinity;
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    let sumX = 0;
    let sumY = 0;
    for (const v of verts) {
      const view = v.clone().applyMatrix4(inverse);
      const depth = -view.z;
      minZ = Math.min(minZ, depth);
      maxZ = Math.max(maxZ, depth);
      if (depth > NEAR_LAYER.near && depth < NEAR_LAYER.far) onNearLayer++;
      const n = v.clone().project(camera);
      const px = ((n.x + 1) / 2) * W;
      const py = ((1 - n.y) / 2) * H;
      sumX += px;
      sumY += py;
      minX = Math.min(minX, px);
      maxX = Math.max(maxX, px);
      minY = Math.min(minY, py);
      maxY = Math.max(maxY, py);
      if (px >= 0 && px <= W && py >= 0 && py <= H) insideFrame++;
    }
    return {
      index: i,
      center: [sumX / verts.length, sumY / verts.length] as [number, number],
      box: [minX, minY, maxX, maxY] as [number, number, number, number],
      heightPct: ((maxY - minY) / H) * 100,
      depthRange: [minZ, maxZ] as [number, number],
      nearLayerFraction: onNearLayer / verts.length,
      insideFrameFraction: insideFrame / verts.length,
    };
  });
}

describe('hero spine calibration', () => {
  it('uses the reference circle: r = 15 in the XZ plane, cards hanging along −Y', () => {
    expect(DEFAULT_RING_SPINE.radius).toBe(15);
    expect(DEFAULT_RING_SPINE.tiltX).toBe(0);
    const frames = buildRingSpineFrames(DEFAULT_RING_SPINE);
    expect(frames).toHaveLength(1024);
    // u = 0 → (15,0,0) with tangent +Z, normal −Y, binormal +X (three's Frenet seed).
    expect(frames[0].position[0]).toBeCloseTo(15, 6);
    expect(frames[0].position[1]).toBeCloseTo(0, 6);
    expect(frames[0].position[2]).toBeCloseTo(0, 6);
    // u = 0 → (15,0,0). three's Frenet tangent is the CHORD direction, not the exact
    // derivative: (-0.000314, 0, 0.99999995) rather than (0,0,1). The reference stores the
    // chord value (evidence/reference/scenes-measured.json row1 col0 = -0.00031, 0, 0.99951
    // after half-float rounding), so reproducing it is the point — the derivative form would
    // have differed in a row the shader multiplies by xWeight = 0.
    expect(frames[0].a[0]).toBeCloseTo(-0.00031415926028030957, 12);
    expect(frames[0].a[1]).toBeCloseTo(0, 12);
    expect(frames[0].a[2]).toBeCloseTo(0.99999995, 8);
    expect(frames[0].b.map((v) => +v.toPrecision(9))).toEqual([0, -1, 0]);
    expect(frames[0].c[0]).toBeCloseTo(0.99999995, 8);
    expect(frames[0].c[1]).toBeCloseTo(0, 12);
    expect(frames[0].c[2]).toBeCloseTo(0.00031415926028030957, 12);
    // u = 0.25 → (0,0,15)
    expect(frames[256].position[1]).toBeCloseTo(0, 6);
    expect(frames[256].position[2]).toBeCloseTo(15, 4);
  });

  it('spineLength is the curve length the reference pushes into the uniform', () => {
    // 512 chords of a r=15 circle (three's Curve.getLength with arcLengthDivisions).
    expect(SPINE_LEN).toBeCloseTo(94.2472, 3);
    expect(HERO_SPINE_UNIFORMS.spineOffset).toBe(161);
    expect(HERO_SPINE_UNIFORMS.pathSegment).toBe(1);
    const p = computeCardPathParams(SPINE_LEN, COUNT, 3, CARD_W);
    expect(p.pathOffset).toBeCloseTo(3 / 9, 12);
    // A card covers exactly its own width of arc (no stretch) in a slightly wider slot.
    expect(p.arcLength).toBeCloseTo(CARD_W, 12);
    expect(p.slotArcLength).toBeGreaterThan(p.arcLength);
  });

  it('puts exactly 4 of the 9 cards on the textured near layer (0.1–69)', () => {
    const cards = projectRing(0);
    const near = cards.filter((c) => c.nearLayerFraction > 0.9);
    expect(near.map((c) => c.index).sort((a, b) => a - b)).toEqual([0, 1, 2, 8]);
    // …and the other five are behind the far plane, i.e. on the untextured layer.
    expect(cards.filter((c) => c.nearLayerFraction < 0.1)).toHaveLength(4);
    expect(cards.filter((c) => c.nearLayerFraction >= 0.1 && c.nearLayerFraction <= 0.9)).toHaveLength(1);
  });

  it('arranges the near cards on a rising diagonal at the measured scale', () => {
    const cards = projectRing(0).filter((c) => c.nearLayerFraction > 0.9).sort((a, b) => a.center[0] - b.center[0]);
    expect(cards.length).toBe(4);
    for (let i = 1; i < cards.length; i++) {
      expect(cards[i].center[0]).toBeGreaterThan(cards[i - 1].center[0]);
      expect(cards[i].center[1]).toBeLessThan(cards[i - 1].center[1]);
    }
    // 12.6 world units at ~55–62 with fov 29.2518 → roughly a third of the viewport.
    for (const c of cards) expect(c.heightPct).toBeGreaterThan(28);
    for (const c of cards) expect(c.heightPct).toBeLessThan(56);
    const mean = cards.reduce((s, c) => s + c.heightPct, 0) / cards.length;
    expect(mean).toBeGreaterThan(33);
    expect(mean).toBeLessThan(48);
    // All four are inside the canvas (the ring is centred, so nothing is edge-cropped).
    for (const c of cards) expect(c.insideFrameFraction).toBeGreaterThan(0.9);
  });

  it('leans the camera with the CURSOR, and not with the scroll wheel', () => {
    // Source: rotation.z = PI/180*-25 + (pointerXInElement - 0.5) * 0.2, recomputed only in a
    // watcher on [pointer, mediaQuery]. The old port drove this from section progress, which
    // made the ring tilt while scrolling — a behaviour the reference does not have.
    const deg = (r: number) => (r * 180) / Math.PI;
    const at = (pointerXInElement: number) => deg((-25 * Math.PI) / 180 + (pointerXInElement - 0.5) * 0.2);
    expect(at(0.5)).toBeCloseTo(-25, 6);
    // measured capture: rotation.z = -0.492 rad = -28.19deg → the cursor sat at 22.17% of the
    // canvas width, which is why the probe recorded -28.19 rather than the -25 source constant
    expect(at(0.2217)).toBeCloseTo(-28.19, 1);
    expect(at(0)).toBeCloseTo(-30.73, 1);
    expect(at(1)).toBeCloseTo(-19.27, 1);
    // rotation.x is the constant half-turn-plus-12deg that makes the -Y cards read upright
    expect(deg(-3.351)).toBeCloseTo(-192, 2);

    stubCanvasContext();
    const restore = muteWebglLogs();
    const scene = createCardRing({
      canvases: [document.createElement('canvas'), document.createElement('canvas')],
    });
    scene.resize(1376, 772, 1.5);
    const frame = (px: number) => ({
      timeSec: 0,
      deltaSec: 1 / 60,
      scrollYPx: 0,
      velocityPxPerSec: 0,
      pointerNdc: { x: px, y: 0 },
      viewport: { width: 1376, height: 772, dpr: 1.5 },
      reducedMotion: true,
    });
    scene.update(frame(-0.5566), 0);
    const atPointer = scene.snapshot().cameraRotation;
    expect(atPointer[0]).toBeCloseTo(-3.351, 3);
    expect(atPointer[2]).toBeCloseTo(-0.492, 3);
    // scrolling must not move it
    scene.update(frame(-0.5566), 0.83);
    expect(scene.snapshot().cameraRotation[2]).toBeCloseTo(atPointer[2], 12);
    restore();
  });

  it('renders the hero at a pinned 2x buffer, not the device ratio', () => {
    // measured: CSS 1376x772 with buffer 2752x1544 on a devicePixelRatio-1.5 screen, so the
    // reference renders the hero sharper than the display can show. A fixed-ratio host must
    // ignore both the device ratio and the frame's dpr.
    stubCanvasContext();
    const restore = muteWebglLogs();
    const hero = new WebGLHost(document.createElement('canvas'), { fixedPixelRatio: 2 });
    expect(hero.effectivePixelRatio(1.5)).toBe(2);
    expect(hero.effectivePixelRatio(3)).toBe(2);
    const other = new WebGLHost(document.createElement('canvas'));
    expect(other.effectivePixelRatio(1.5)).toBeLessThanOrEqual(1.5);
    hero.dispose();
    other.dispose();
    restore();
  });
});

describe('hero spine texture — read back from the live reference', () => {
  // evidence/reference/scenes-measured.json §spineTexture.rows, captured by reading
  // material.onBeforeCompile's uniform bag out of the running page. These are the values the
  // reference GPU actually samples, in half-float, so the tolerance is half-float rounding.
  const measured: Record<number, { r0: number[]; r1: number[]; r2: number[]; r3: number[] }> = {
    0: { r0: [15, 0, 0], r1: [-0.00031, 0, 0.99951], r2: [0, -1, 0], r3: [0.99951, 0, 0.00031] },
    1: { r0: [14.99219, 0, 0.09198], r1: [-0.00613, 0, 0.99951], r2: [0, -1, 0], r3: [0.99951, 0, 0.00613] },
    4: { r0: [14.99219, 0, 0.36792], r1: [-0.02454, 0, 0.99951], r2: [0, -1, 0], r3: [0.99951, 0, 0.02454] },
    128: { r0: [10.60156, 0, 10.60156], r1: [-0.70703, 0, 0.70703], r2: [0, -1, 0], r3: [0.70703, 0, 0.70703] },
    256: { r0: [0, 0, 15], r1: [-1, 0, 0], r2: [0, -1, 0], r3: [0, 0, 1] },
    341: { r0: [-7.47266, 0, 13], r1: [-0.8667, 0, -0.49805], r2: [0, -1, 0], r3: [-0.49805, 0, 0.8667] },
    512: { r0: [-15, 0, 0], r1: [0, 0, -1], r2: [0, -1, 0], r3: [-1, 0, 0] },
    768: { r0: [0, 0, -15], r1: [1, 0, 0], r2: [0, -1, 0], r3: [0, 0, -1] },
    1023: { r0: [14.99219, 0, -0.09198], r1: [0.00613, 0, 0.99951], r2: [0, -1, 0], r3: [0.99951, 0, -0.00613] },
  };
  const frames = buildRingSpineFrames(DEFAULT_RING_SPINE);
  const data = buildSpineTextureData(frames);
  const W = DEFAULT_RING_SPINE.samples;
  const texel = (row: number, col: number, k: number) =>
    THREE.DataUtils.fromHalfFloat(data[(row * W + col) * 4 + k]);

  it('is the same 1024x4 half-float RGBA texture the reference builds', () => {
    expect(data).toBeInstanceOf(Uint16Array);
    expect(data.length).toBe(16384); // measured dataLength
    expect(frames.length).toBe(1024);
  });

  it.each(Object.keys(measured).map(Number))(
    'reproduces every measured texel at column %i',
    (col) => {
      const m = measured[col];
      for (const [row, key] of [[0, 'r0'], [1, 'r1'], [2, 'r2'], [3, 'r3']] as const) {
        for (let k = 0; k < 3; k++) {
          expect(texel(row, col, k), `row${row} col${col} ch${k}`).toBeCloseTo(m[key][k], 4);
        }
      }
    },
  );

  it('keeps the spine a flat radius-15 circle (x^2 + z^2 = 225, y = 0)', () => {
    // Half-float spacing just below 16 is 2^3 · 2^-10 = 0.0078125, so a stored coordinate can
    // sit up to 0.0078 off the true radius on BOTH sides. Anything tighter asserts against the
    // number format rather than against the reference.
    for (let col = 0; col < W; col++) {
      const x = texel(0, col, 0);
      const y = texel(0, col, 1);
      const z = texel(0, col, 2);
      expect(Math.abs(y)).toBeLessThan(1e-3);
      expect(Math.hypot(x, z)).toBeGreaterThan(14.99);
      expect(Math.hypot(x, z)).toBeLessThan(15.01);
    }
  });

  it('matches the measured spineLength uniform to 10 decimals', () => {
    // measured 94.24718821101328 = Curve.getLength() with arcLengthDivisions 512. The closed
    // form differs in the 13th decimal because three sums 512 chords in a loop; that is float
    // accumulation order, not a different curve.
    expect(SPINE_LEN).toBeCloseTo(94.24718821101328, 10);
  });
});

describe('nexus + get-seen calibration', () => {
  it('reproduces the measured nexus camera pose from the pointer orbit', () => {
    // webgl-scenes.json: position [0.6412,-0.8657,3.9274] for the pointer at
    // (0.2994, 0.2290) of the element → ndc (-0.4012, -0.5420).
    const pose = nexusCameraState({ x: -0.4012, y: -0.542 });
    expect(pose.position[0]).toBeCloseTo(0.6412, 2);
    expect(pose.position[1]).toBeCloseTo(-0.8657, 2);
    expect(pose.position[2]).toBeCloseTo(3.9274, 2);
    expect(pose.target).toEqual([0, 0, -4]);
  });

  it('reproduces the measured nexus scroll samples (y +1.1 while progress 1 → −0.25)', () => {
    const entry = nexusScrollState(0);
    expect(entry.shaderProgress).toBeCloseTo(-0.25, 6);
    expect(entry.rise).toBeCloseTo(0, 6);
    const exit = nexusScrollState(1);
    expect(exit.shaderProgress).toBeCloseTo(1, 6);
    expect(exit.rise).toBeCloseTo(1.1, 6);
  });

  it('drives the nexus camera through update() to the measured rotation too', () => {
    stubCanvasContext();
    const restore = muteWebglLogs();
    const scene = createCurvedPanel({ canvas: document.createElement('canvas') }) as unknown as {
      resize(w: number, h: number, d: number): void;
      update(f: unknown, p: number): void;
      snapshot(): { cameraPosition: [number, number, number]; cameraRotation: [number, number, number] };
    };
    scene.resize(1032, 826, 1);
    scene.update(
      {
        timeSec: 1,
        deltaSec: 1 / 60,
        scrollYPx: 0,
        velocityPxPerSec: 0,
        pointerNdc: { x: -0.4012, y: -0.542 },
        viewport: { width: 1032, height: 826, dpr: 1 },
        reducedMotion: false,
      },
      0,
    );
    restore();
    const snap = scene.snapshot();
    expect(snap.cameraPosition[0]).toBeCloseTo(0.6412, 2);
    // lookAt(0,0,-4) from that position → the measured Euler (0.1088, 0.0802, -0.0088)
    expect(snap.cameraRotation[0]).toBeCloseTo(0.1088, 2);
    expect(snap.cameraRotation[1]).toBeCloseTo(0.0802, 2);
    expect(snap.cameraRotation[2]).toBeCloseTo(-0.0088, 2);
  });

  it('yields the measured get-seen uniforms at section entry', () => {
    expect(getSeenProgress(0).start).toBeCloseTo(-0.25, 6);
    expect(getSeenProgress(0).end).toBeCloseTo(0, 6);
    // webgl-scenes.json measured progressStart −0.25 / progressEnd 0 at capture.
    const mid = getSeenProgress(0.5);
    expect(mid.start).toBeGreaterThan(-0.25);
    expect(mid.end).toBe(0);
    // The reference exit ramp runs to −2 viewport heights, so a section progress of 1
    // (one viewport past the top) is only half way along it.
    const out = getSeenProgress(1);
    expect(out.end).toBeCloseTo(1 - Math.cos(Math.PI / 4), 6);
    // …and the bend reverses again on the way out (o − s shrinks back below 1).
    expect(out.start).toBeCloseTo(0.375, 6);
  });
});
