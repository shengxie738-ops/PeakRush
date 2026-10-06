/**
 * createPointerPanel.ts — the `landing-2-get-seen` scene (home.get-seen).
 *
 * Transcribed from the reference component chunk `evidence/reference/raw/_nuxt/
 * wH0WNvJv.js` (`Landing2GetSeenWebGl`) plus `evidence/reference/webgl-scenes.json`:
 *
 *   geometry  PlaneGeometry(1, 1/460*540, 20, 20)      // 1 × 1.173913043478261
 *   material  ShaderMaterial side=2 defines { USE_MOUSE: desktop ? 1 : 0 }
 *             uniforms imageTexture | mousePos | progressStart | progressEnd
 *   texture   /images/landing/2.get-seen/video-preview.png loaded WITHOUT a
 *             colorSpace assignment → sampled raw → acquired as `colorSpace: 'none'`
 *   camera    source { fov: 28, near: 0, far: 200, position: [0,-0.048,2.04] }
 *             measured { fov: 42.2793, near: 0.1, far: 200, aspect 0.8518 }
 *
 * The scroll driver in the reference watches the element's top in viewport-height
 * units and builds two ramps:
 *   t = top/vh            reveal ramp o = clamp01((0.75 - t)/0.75)   (0.75vh → 0vh)
 *   exit ramp s = clamp01(-t/2)                                      (0vh → -2vh)
 *   progressStart = -0.25 + 1.25 * easeInOutSine(o - s)
 *   progressEnd   = easeOutSine(s)
 * This clone hands scenes a normalised section progress p (0 = one viewport below the
 * fold, 1 = one viewport past the top), which maps back exactly: t = 1 - 2p. At p = 0
 * that yields progressStart = -0.25 / progressEnd = 0 — the values measured in
 * webgl-scenes.json — so the reference curve is reproduced, not invented.
 *
 * `update` stays a pure function of (progress, pointerNdc): nothing is accumulated.
 */
import * as THREE from 'three';
import type { FrameInput, SceneController, SectionId } from '@/motion/motion.types';
import { WebGLHost } from './createWebGLHost';
import { textureRegistry } from './textureRegistry';
import pointerVert from './shaders/pointer.vert.glsl?raw';
import pointerFrag from './shaders/pointer.frag.glsl?raw';

const CAMERA = { fov: 42.2793, near: 0.1, far: 200, pos: [0, -0.048, 2.04] } as const;
/** Reference plane height: 1 / 460 * 540 (the video-preview crop ratio). */
const PLANE_H = (1 / 460) * 540;
const PROGRESS_START_AT_ENTRY = -0.25;
const PROGRESS_SPAN = 1.25; // -0.25 → 1

const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v);
/** `n(e) = -0.5*(cos(PI*e)-1)` from xAAeZd5K.js — easeInOutSine. */
const easeInOutSine = (x: number): number => 0.5 * (1 - Math.cos(Math.PI * clamp01(x)));
/** `t(x) = 1 - cos(x*PI/2)` from xAAeZd5K.js — easeOutSine. */
const easeOutSine = (x: number): number => 1 - Math.cos(clamp01(x) * Math.PI / 2);

/** Reference reveal/exit ramps expressed through the clone's section progress. */
export function getSeenProgress(progress: number): { start: number; end: number } {
  const t = 1 - 2 * clamp01(progress);
  const reveal = clamp01((0.75 - t) / 0.75);
  const exit = clamp01(-t / 2);
  return {
    start: PROGRESS_START_AT_ENTRY + PROGRESS_SPAN * easeInOutSine(reveal - exit),
    end: easeOutSine(exit),
  };
}

export interface PointerPanelOptions {
  canvas: HTMLCanvasElement;
  id?: SectionId;
  textureUrl?: string;
}

export interface PointerPanelSnapshot {
  progressStart: number;
  progressEnd: number;
  mousePos: [number, number];
  meshMatrix: number[];
}

export interface PointerPanelController extends SceneController {
  snapshot(): PointerPanelSnapshot;
}

export function createPointerPanel(options: PointerPanelOptions): PointerPanelController {
  const id = options.id ?? 'home.get-seen';
  const url = options.textureUrl ?? '/assets/product/video-preview.png';

  const host = new WebGLHost(options.canvas);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(CAMERA.fov, 1, CAMERA.near, CAMERA.far);
  camera.position.set(CAMERA.pos[0], CAMERA.pos[1], CAMERA.pos[2]);

  const geometry = new THREE.PlaneGeometry(1, PLANE_H, 20, 20);
  // Sampled straight to gl_FragColor with no output encode → keep the pixels raw.
  const imageTexture = textureRegistry.acquire(url, { colorSpace: 'none' });

  const uniforms: Record<string, THREE.IUniform> = {
    imageTexture: { value: imageTexture },
    mousePos: { value: new THREE.Vector2(0, 0) },
    progressStart: { value: PROGRESS_START_AT_ENTRY },
    progressEnd: { value: 0 },
    // Declared by the captured shader but unused by it; kept so the uniform set matches
    // the measurement exactly (three skips uniforms the linker optimised away).
    radius: { value: 0 },
  };

  const material = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: pointerVert,
    fragmentShader: pointerFrag,
    defines: { USE_MOUSE: 1 },
    side: THREE.DoubleSide,
    transparent: true,
    depthWrite: true,
  });

  const mesh = new THREE.Mesh(geometry, material);
  scene.add(mesh);

  let disposed = false;

  const applyState = (frame: FrameInput, progress: number): void => {
    const { start, end } = getSeenProgress(progress);
    uniforms.progressStart!.value = start;
    uniforms.progressEnd!.value = end;
    const mouse = uniforms.mousePos!.value as THREE.Vector2;
    // Reference: mousePos = (2*relX-1, -(2*relY-1)) of the pointer inside the element —
    // i.e. the same NDC space the motion runtime already hands over.
    mouse.set(frame.reducedMotion ? 0 : frame.pointerNdc.x, frame.reducedMotion ? 0 : frame.pointerNdc.y);
  };

  return {
    id,

    update(frame: FrameInput, progress: number): void {
      if (disposed) return;
      applyState(frame, progress);
      host.setViewport();
      host.render(scene, camera);
    },

    snapshot(): PointerPanelSnapshot {
      const mouse = uniforms.mousePos!.value as THREE.Vector2;
      return {
        progressStart: uniforms.progressStart!.value as number,
        progressEnd: uniforms.progressEnd!.value as number,
        mousePos: [mouse.x, mouse.y],
        meshMatrix: Array.from(mesh.matrixWorld.elements),
      };
    },

    resize(width: number, height: number, dpr: number): void {
      if (disposed) return;
      host.setSize(width, height, dpr);
      camera.aspect = height > 0 ? width / height : 1;
      camera.updateProjectionMatrix();
    },

    dispose(): void {
      if (disposed) return;
      disposed = true;
      geometry.dispose();
      material.dispose();
      textureRegistry.release(url);
      scene.clear();
      host.dispose();
    },
  };
}
