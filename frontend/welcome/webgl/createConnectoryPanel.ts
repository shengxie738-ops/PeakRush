/**
 * createConnectoryPanel.ts — the `landing-7-connectory` scene (home.connectory).
 *
 * Transcribed from the reference component `Landing7ConnectoryWebGl`
 * (evidence/reference/raw/_nuxt/CrHBTwDc.js), with the vertex shader from
 * ./C4ipafMf.js and the fragment shader from ./si6jlswl.js. Both are now stored
 * verbatim as shaders/connectory.*.glsl.
 *
 *   const ee = .4, v = 18;                                  // sway amplitude, orbit radius
 *   camera: { fov: 28, far: 69, position: [0,0,4], rotation: [0,0,0] }
 *   geometry: Plane(1, 1/1460*780, 30, 30)                   // = 1 x 0.5342465753
 *   mesh: { radius: 6.3, offset: -5.4, progressScale: .87, scale: 4,
 *           position: (-12.4, -3.6, 8.8), rotation: (.24, 1.95, -.04) }
 *   // scroll:  e = remap(sectionTop + canvasTop, svh*100, svh*-100, .5, -.5)
 *   //          progress.y = e * -1.5 ;  mesh.position.y = e * 16 + -3.6
 *   // pointer: r = (px - .5) * ee + PI/2 ; m = (py - .5) * ee
 *   //          camera.position = (18cos r, 18 sin m, 4 + 18 sin r cos m - 18)
 *   //          camera.lookAt(0, 0, 4 - 18)
 *
 * The runtime's section `progress` is built from exactly the same window the
 * reference remaps (start = top - one viewport, end = top + one viewport, see
 * App.vue rangeFor), so `e = 0.5 - progress` reproduces the reference endpoints
 * without inventing an easing curve.
 *
 * NOTE ON SCENE IDs: evidence/reference/scenes-measured.json (and the 2026-10-01
 * NEXT_ACTIONS table built from it) labels the 8-plane pool `landing-7-connectory`
 * and this single curved panel `landing-9-testimonials`. The component sources prove
 * that is transposed, and the downloaded textures agree: Review-1..8.png are
 * 1380x1380 squares (Plane(1,1)) and belong to Landing9TestimonialsWebGl, while
 * decor/image.png is 2920x1560 (aspect 1460:780 = the 0.5342465753 plane) and is the
 * file Landing7ConnectoryWebGl loads. See evidence/reference/webgl-scenes-corrected.md.
 */
import * as THREE from 'three';
import type { FrameInput, SceneController, SectionId } from '@/motion/motion.types';
import { WebGLHost } from './createWebGLHost';
import { textureRegistry } from './textureRegistry';
import connectoryVert from './shaders/connectory.vert.glsl?raw';
import connectoryFrag from './shaders/connectory.frag.glsl?raw';

/** Verbatim from Landing7ConnectoryWebGl. */
const SWAY = 0.4;
const ORBIT_RADIUS = 18;
const CAMERA_BASE: [number, number, number] = [0, 0, 4];
const PROGRESS_SCALE = 0.87;
const PROGRESS_Y_GAIN = -1.5;
/** Plane(1, 1/1460*780, 30, 30) — 780/1460 = 0.5342465753424658. */
const PLANE_HEIGHT = (1 / 1460) * 780;
const MESH = {
  radius: 6.3,
  offset: -5.4,
  /** Desktop branch of `position: t.value ? (-13.32,-8,9.56) : (-12.4,-3.6,8.8)`. */
  position: [-12.4, -3.6, 8.8] as [number, number, number],
  rotation: [0.24, 1.95, -0.04] as [number, number, number],
  scale: 4,
};
/** `L.position.y = e * 16 + y` with desktop y = -3.6. */
const Y_TRAVEL = 16;
const TEXTURE_URL = '/peakrush/collection-wide.png';

const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v);

/** The reference's `Q(top, svh*100, svh*-100, .5, -.5, true)` over the runtime's progress window. */
export function connectoryRemap(progress: number): number {
  return 0.5 - clamp01(progress);
}

/** progress + pointer → the reference's mesh y, shader progress.y and camera pose. */
export function connectoryState(progress: number, pointerNdc: { x: number; y: number }): {
  meshY: number;
  progressY: number;
  cameraPosition: [number, number, number];
  target: [number, number, number];
} {
  const e = connectoryRemap(progress);
  const px = (pointerNdc.x + 1) / 2;
  const py = (pointerNdc.y + 1) / 2;
  const r = (px - 0.5) * SWAY + Math.PI * 0.5;
  const m = (py - 0.5) * SWAY;
  return {
    meshY: e * Y_TRAVEL + MESH.position[1],
    progressY: e * PROGRESS_Y_GAIN,
    cameraPosition: [
      CAMERA_BASE[0] + ORBIT_RADIUS * Math.cos(r),
      CAMERA_BASE[1] + ORBIT_RADIUS * Math.sin(m),
      CAMERA_BASE[2] + ORBIT_RADIUS * Math.sin(r) * Math.cos(m) - ORBIT_RADIUS,
    ],
    target: [0, 0, CAMERA_BASE[2] - ORBIT_RADIUS],
  };
}

export interface ConnectoryOptions {
  canvas: HTMLCanvasElement;
  id?: SectionId;
}

export interface ConnectorySnapshot {
  cameraPosition: [number, number, number];
  meshPosition: [number, number, number];
  shaderProgress: [number, number];
  uniforms: { radius: number; offset: number; progressScale: number; alpha: number };
}

export interface ConnectoryController extends SceneController {
  snapshot(): ConnectorySnapshot;
}

export function createConnectoryPanel(options: ConnectoryOptions): ConnectoryController {
  const id = options.id ?? 'home.connectory';
  const host = new WebGLHost(options.canvas);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(28, 1, 0.1, 69);
  camera.position.set(...CAMERA_BASE);

  const geometry = new THREE.PlaneGeometry(1, PLANE_HEIGHT, 30, 30);
  const imageTexture = textureRegistry.acquire(TEXTURE_URL, { colorSpace: 'none' });
  const uniforms: Record<string, THREE.IUniform> = {
    imageTexture: { value: imageTexture },
    // The reference's `progress` is a vec2 and only .y is ever written; .x stays 0.
    progress: { value: new THREE.Vector2(0, 0) },
    radius: { value: MESH.radius },
    offset: { value: MESH.offset },
    progressScale: { value: PROGRESS_SCALE },
    alpha: { value: 1 },
  };
  const material = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: connectoryVert,
    fragmentShader: connectoryFrag,
    side: THREE.DoubleSide,
    transparent: true,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.frustumCulled = false;
  mesh.position.set(...MESH.position);
  mesh.rotation.set(...MESH.rotation);
  mesh.scale.setScalar(MESH.scale);
  scene.add(mesh);

  let disposed = false;

  return {
    id,

    update(frame: FrameInput, progress: number): void {
      if (disposed) return;
      const s = connectoryState(progress, frame.reducedMotion ? { x: 0, y: 0 } : frame.pointerNdc);
      mesh.position.y = s.meshY;
      (uniforms.progress!.value as THREE.Vector2).y = s.progressY;
      camera.position.set(...s.cameraPosition);
      camera.lookAt(s.target[0], s.target[1], s.target[2]);
      host.setViewport();
      host.render(scene, camera);
    },

    /** Exposed for tests: the measured values must survive construction untouched. */
    snapshot(): ConnectorySnapshot {
      return {
        cameraPosition: camera.position.toArray() as [number, number, number],
        meshPosition: mesh.position.toArray() as [number, number, number],
        shaderProgress: [
          (uniforms.progress!.value as THREE.Vector2).x,
          (uniforms.progress!.value as THREE.Vector2).y,
        ],
        uniforms: {
          radius: uniforms.radius!.value as number,
          offset: uniforms.offset!.value as number,
          progressScale: uniforms.progressScale!.value as number,
          alpha: uniforms.alpha!.value as number,
        },
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
      textureRegistry.release(TEXTURE_URL);
      scene.clear();
      host.dispose();
    },
  };
}
