/**
 * createCardRing.ts — the hero `landing-1-intro` scene.
 *
 * Transcribed from the reference renderer chunk
 * `evidence/reference/raw/_nuxt/CDL_IiwC.js` + the measurements in
 * `evidence/reference/webgl-scenes.json` and `evidence/reference/shaders/`:
 *
 *   • 9 × PlaneGeometry(9, 12.6, 10, 1) meshes, ALL with identity transforms; the ring
 *     arrangement + bend live entirely in the vertex shader, driven by the spine
 *     uniforms (spineTexture / pathOffset / pathSegment / spineOffset / spineLength /
 *     flow). `updateCurve(0, circle)` sets spineLength = curve length (94.2475 for the
 *     r=15 circle), spineOffset stays at the factory default 161 and pathSegment at 1,
 *     and every card is shifted with `moveAlongCurve(index / 9)`.
 *   • TWO renderers on TWO canvases, same camera, complementary depth ranges. The
 *     captured projection matrices pin which program belongs to which depth band
 *     (m22/m23 of evidence/reference/shaders/hero-summary.json):
 *        program index 1 — `#define USE_MAP`   → near 0.1   far 69   → the NEAR cards
 *        program index 0 — no map, `diffuse`    → near 69    far 200  → the FAR cards
 *     and the reference CSS pushes the first canvas behind (`canvas:first-child
 *     {z-index:-1}`), i.e. DOM canvas 0 = far/untextured, DOM canvas 1 = near/textured.
 *     The previous port had this exactly the other way round, which is why the hero
 *     rendered no card artwork at all.
 *   • far material: `new MeshBasicMaterial({ color: '#B05A2E', side: DoubleSide })`.
 *   • near material: `new MeshBasicMaterial({ map: Card-i.png, side: DoubleSide })`
 *     with `texture.colorSpace = SRGBColorSpace` set on load (the shader applies the
 *     sRGB OETF itself in `linearToOutputTexel`, so hardware-decode + shader-encode is
 *     one round trip: the artwork keeps its authored colours).
 *   • camera: fov 29.2518 — measured twice independently and agreeing exactly: the live
 *     camera reports it, and inverting the captured projection matrix
 *     (`m[5] = 3.8319625854492188` → 2·atan(1/m5)) gives the same number, with
 *     m[0]/m[5] = 1.78234 = 1376/772 for the aspect. Position (0,-14,-70),
 *     rotation.x = -192deg fixed, rotation.z = -25deg + (pointerXInElement - 0.5)·0.2 rad.
 *     The -28.19deg captured at probe time therefore means the cursor sat at 22.17% of the
 *     canvas width — it is NOT a scroll state.
 *   • idle spin: `beforeRender` advances every card by `deltaTime * -5e-5` turns,
 *     i.e. -0.05 turns/s — one revolution every 20 s. Here that is expressed as a PURE
 *     function of frame.timeSec so a scene can never accumulate state per frame. The
 *     resulting envelope of on-screen cards is phase-invariant (9-fold symmetry), which is
 *     what `scripts/check-hero-cards.mjs` now asserts against.
 */
import * as THREE from 'three';
import type { FrameInput, SceneController, SectionId } from '@/motion/motion.types';
import {
  buildRingSpineFrames,
  buildSpineTextureData,
  computeCardPathParams,
  DEFAULT_RING_SPINE,
  HERO_SPINE_UNIFORMS,
  ringArcLength,
  type RingSpineConfig,
} from './geometry';
import { WebGLHost } from './createWebGLHost';
import { textureRegistry } from './textureRegistry';
import heroAVert from './shaders/hero-a.vert.glsl?raw';
import heroAFrag from './shaders/hero-a.frag.glsl?raw';
import heroBVert from './shaders/hero-b.vert.glsl?raw';
import heroBFrag from './shaders/hero-b.frag.glsl?raw';

export interface CardRingCalibration {
  /** Idle ring rotation in turns/second. Reference: deltaTime * -5e-5 → -0.05 → 20 s period. */
  turnsPerSec: number;
  /** Extra turns contributed by section progress. MEASURED: 0 — scrolling does not wind the ring. */
  progressTurns: number;
  /** Constant camera rotation about X, degrees. Measured -3.351 rad = -192.0deg. */
  rotXDeg: number;
  /** Camera rotation about Z at pointer-centre, degrees. Measured source constant: -25. */
  rotZBaseDeg: number;
  /**
   * Total camera rotation about Z across pointer travel 0..1, radians. Reference source: 0.2.
   * NOT a scroll channel: the reference recomputes this in a watcher on
   * `[pointerXInElement, smDown]` only, so the ring leans under the cursor and stays put while
   * the page scrolls. Driving it from section progress was a wrong interaction model.
   */
  rotZPointerSwingRad: number;
  /** Camera position. Measured (0, -14, -70); only the `sm-down` breakpoint changes it. */
  cameraPosition: [number, number, number];
  /** Ring geometry (radius / centre / tilt / sample count). */
  spine: RingSpineConfig;
}

export const DEFAULT_CARD_RING_CALIBRATION: CardRingCalibration = {
  turnsPerSec: -0.05,
  progressTurns: 0,
  rotXDeg: -192,
  rotZBaseDeg: -25,
  rotZPointerSwingRad: 0.2,
  cameraPosition: [0, -14, -70],
  spine: DEFAULT_RING_SPINE,
};

export interface CardRingOptions {
  /** Exactly two canvases — [far/untextured layer, near/textured layer] — like the reference. */
  canvases: readonly [HTMLCanvasElement, HTMLCanvasElement];
  id?: SectionId;
  cardCount?: number;
  calibration?: Partial<CardRingCalibration>;
  /** Overrides the /assets/cards/Card-i.png URLs (1-based). */
  textureUrlFor?: (index: number) => string;
}

/** Measured camera constants (fov/near/far per depth layer). */
const CAMERA = {
  fov: 29.2518,
  nearLayer: { near: 0.1, far: 69 },
  farLayer: { near: 69, far: 200 },
} as const;

const CALIBRATION_SPINE_PHASE = 0;
const PLANE_W = 9;
const PLANE_H = 12.6;
/** Measured: buffer 2752x1544 for a CSS 1376x772 canvas, i.e. ratio 2 regardless of device. */
const HERO_PIXEL_RATIO = 2;
/** `new MeshBasicMaterial({ color: new Color('#B05A2E') })` from CDL_IiwC.js. */
const FAR_LAYER_COLOR = '#B05A2E';

/** What a unit test needs to prove determinism without touching the GPU. */
export interface CardRingSnapshot {
  cameraPosition: [number, number, number];
  cameraRotation: [number, number, number];
  pathOffsets: number[];
  meshMatrices: number[][];
  spineLength: number;
}

export interface CardRingController extends SceneController {
  snapshot(): CardRingSnapshot;
}

function makeSpineTexture(config: RingSpineConfig): THREE.DataTexture {
  const frames = buildRingSpineFrames(config);
  const data = buildSpineTextureData(frames);
  const tex = new THREE.DataTexture(data, config.samples, 4, THREE.RGBAFormat, THREE.HalfFloatType);
  // Read back off the live reference, not inferred: magFilter/minFilter are
  // NearestFilter (1006) and wrapT is ClampToEdgeWrapping (1001) even though the source
  // writes `e.wrapY = C` — three names the property `wrapT`, so that assignment is a no-op
  // and the DataTexture default (ClampToEdge) survives. Repeat on S is what makes the
  // closed ring wrap. Sampling lands on texel centres either way, so this is exactness
  // rather than a visible fix.
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.generateMipmaps = false;
  tex.colorSpace = THREE.NoColorSpace;
  tex.needsUpdate = true;
  return tex;
}

export function createCardRing(options: CardRingOptions): CardRingController {
  const id = options.id ?? 'home.hero';
  const count = options.cardCount ?? 9;
  const calib: CardRingCalibration = {
    ...DEFAULT_CARD_RING_CALIBRATION,
    ...options.calibration,
    spine: { ...DEFAULT_RING_SPINE, ...(options.calibration?.spine ?? {}) },
  };
  const urlFor = options.textureUrlFor ?? ((i: number) => `/assets/cards/Card-${i}.png`);

  // DOM order mirrors the reference: canvas 0 is pushed to the back (far layer),
  // canvas 1 sits on top and carries the near, textured cards.
  // Both are pinned to a 2x drawing buffer: measured CSS box 1376x772 vs buffer 2752x1544
  // on a device whose devicePixelRatio is 1.5, so the reference deliberately renders the
  // hero sharper than the display.
  const hostFar = new WebGLHost(options.canvases[0], { fixedPixelRatio: HERO_PIXEL_RATIO });
  const hostNear = new WebGLHost(options.canvases[1], { fixedPixelRatio: HERO_PIXEL_RATIO });

  const spineLength = ringArcLength(calib.spine.radius, calib.spine.arcLengthDivisions);
  const geometryFar = new THREE.PlaneGeometry(PLANE_W, PLANE_H, 10, 1);
  const geometryNear = new THREE.PlaneGeometry(PLANE_W, PLANE_H, 10, 1);
  const spineTexture = makeSpineTexture(calib.spine);

  const sceneFar = new THREE.Scene();
  const sceneNear = new THREE.Scene();

  const camFar = new THREE.PerspectiveCamera(CAMERA.fov, 1, CAMERA.farLayer.near, CAMERA.farLayer.far);
  const camNear = new THREE.PerspectiveCamera(CAMERA.fov, 1, CAMERA.nearLayer.near, CAMERA.nearLayer.far);
  for (const cam of [camFar, camNear]) cam.position.set(...calib.cameraPosition);

  const textureUrls: string[] = [];
  const materials: THREE.RawShaderMaterial[] = [];
  const meshesFar: THREE.Mesh[] = [];
  const meshesNear: THREE.Mesh[] = [];
  /** every `pathOffset` uniform that belongs to card `index` (far + near layer). */
  const pathOffsetUniforms: THREE.IUniform[][] = [];

  const baseUniforms = (
    pathOffset: number,
    diffuse: THREE.Color,
    map: THREE.Texture | null,
  ): Record<string, THREE.IUniform> => {
    const u: Record<string, THREE.IUniform> = {
      spineTexture: { value: spineTexture },
      pathOffset: { value: pathOffset },
      pathSegment: { value: HERO_SPINE_UNIFORMS.pathSegment },
      spineOffset: { value: HERO_SPINE_UNIFORMS.spineOffset },
      spineLength: { value: spineLength },
      flow: { value: HERO_SPINE_UNIFORMS.flow },
      diffuse: { value: diffuse },
      opacity: { value: 1 },
    };
    if (map) {
      u.map = { value: map };
      u.mapTransform = { value: new THREE.Matrix3() };
    }
    return u;
  };

  for (let i = 0; i < count; i++) {
    const p = computeCardPathParams(spineLength, count, i, PLANE_W, CALIBRATION_SPINE_PHASE);
    pathOffsetUniforms[i] = [];

    // FAR layer (near 69 / far 200): the captured hero-0 program, no USE_MAP → solid
    // #B05A2E silhouettes behind the near cards.
    const uniFar = baseUniforms(p.pathOffset, new THREE.Color(FAR_LAYER_COLOR), null);
    const matFar = new THREE.RawShaderMaterial({
      uniforms: uniFar,
      vertexShader: heroAVert,
      fragmentShader: heroAFrag,
      glslVersion: THREE.GLSL3,
      side: THREE.DoubleSide,
      transparent: false,
      depthWrite: true,
    });
    const meshFar = new THREE.Mesh(geometryFar, matFar); // identity transform, like the reference
    sceneFar.add(meshFar);
    materials.push(matFar);
    meshesFar.push(meshFar);
    pathOffsetUniforms[i].push(uniFar.pathOffset);

    // NEAR layer (near 0.1 / far 69): the captured hero-1 program with USE_MAP.
    const url = urlFor(i + 1);
    textureUrls.push(url);
    const map = textureRegistry.acquire(url, { colorSpace: 'srgb' });
    const uniNear = baseUniforms(p.pathOffset, new THREE.Color(1, 1, 1), map);
    const matNear = new THREE.RawShaderMaterial({
      uniforms: uniNear,
      vertexShader: heroBVert,
      fragmentShader: heroBFrag,
      glslVersion: THREE.GLSL3,
      side: THREE.DoubleSide,
      transparent: false,
      depthWrite: true,
    });
    const meshNear = new THREE.Mesh(geometryNear, matNear);
    sceneNear.add(meshNear);
    materials.push(matNear);
    meshesNear.push(meshNear);
    pathOffsetUniforms[i].push(uniNear.pathOffset);
  }

  let disposed = false;

  const applyState = (frame: FrameInput, progress: number): void => {
    // Ring spin as a pure function of time: base slot + turnsPerSec * timeSec.
    const spin = frame.reducedMotion
      ? 0
      : frame.timeSec * calib.turnsPerSec + progress * calib.progressTurns;
    for (let i = 0; i < count; i++) {
      const value = i / count + spin;
      for (const u of pathOffsetUniforms[i]) u.value = value;
    }

    // Camera: the roll follows the CURSOR, not the scroll wheel. The hero canvas box is the
    // full viewport width (measured rect [0,0,1376,772]), so element-normalised pointer x is
    // just the NDC x remapped to 0..1.
    const pointerXInElement = (frame.pointerNdc.x + 1) / 2;
    const rotX = (calib.rotXDeg * Math.PI) / 180;
    const rotZ =
      (calib.rotZBaseDeg * Math.PI) / 180 +
      (pointerXInElement - 0.5) * calib.rotZPointerSwingRad;
    for (const cam of [camFar, camNear]) {
      cam.position.set(calib.cameraPosition[0], calib.cameraPosition[1], calib.cameraPosition[2]);
      cam.rotation.set(rotX, 0, rotZ);
      cam.updateMatrixWorld(true);
    }
  };

  const applySize = (w: number, h: number, dpr: number) => {
    const aspect = h > 0 ? w / h : 1;
    hostFar.setSize(w, h, dpr);
    hostNear.setSize(w, h, dpr);
    camFar.aspect = aspect;
    camNear.aspect = aspect;
    camFar.updateProjectionMatrix();
    camNear.updateProjectionMatrix();
  };

  return {
    id,

    update(frame: FrameInput, progress: number): void {
      if (disposed) return;
      // State is applied even when the GL context is unavailable: `update` must be a
      // pure function of (timeSec, progress, pointerNdc) regardless of the renderer.
      applyState(frame, progress);
      hostFar.setViewport();
      hostFar.render(sceneFar, camFar);
      hostNear.setViewport();
      hostNear.render(sceneNear, camNear);
    },

    resize(width: number, height: number, dpr: number): void {
      if (disposed) return;
      applySize(width, height, dpr);
    },

    snapshot(): CardRingSnapshot {
      const offsets: number[] = [];
      for (let i = 0; i < count; i++) offsets.push(pathOffsetUniforms[i][0].value as number);
      return {
        cameraPosition: camNear.position.toArray() as [number, number, number],
        cameraRotation: [camNear.rotation.x, camNear.rotation.y, camNear.rotation.z],
        pathOffsets: offsets,
        meshMatrices: [...meshesNear, ...meshesFar].map((m) => Array.from(m.matrixWorld.elements)),
        spineLength,
      };
    },

    dispose(): void {
      if (disposed) return;
      disposed = true;
      geometryFar.dispose();
      geometryNear.dispose();
      spineTexture.dispose();
      for (const m of materials) m.dispose();
      for (const url of textureUrls) textureRegistry.release(url);
      sceneFar.clear();
      sceneNear.clear();
      hostFar.dispose();
      hostNear.dispose();
    },
  };
}
