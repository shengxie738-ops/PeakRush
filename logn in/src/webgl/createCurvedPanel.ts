/**
 * createCurvedPanel.ts — the `landing-5-nexus` scene (home.card).
 *
 * Two cards wrapped around a cylinder, driven by the EXACT captured reference shader
 * (shaders/nexus.*.glsl, verbatim from webgl-scenes.json). The arc bend happens in the
 * vertex shader; everything else here is transcribed from the reference component chunk
 * `evidence/reference/raw/_nuxt/DrDDqcjH.js` (`Landing5NexusWebGl`):
 *
 *   const y = .4, i = 8;                       // sway amplitude, orbit radius
 *   camera: { fov: 30.65, far: 69, position: [0, 0, 4], rotation: [0, 0, 0] }
 *   // pointer-driven sway (g = pointer x 0..1, h = pointer y 0..1 inside the section):
 *   const r = (g - .5) * y + Math.PI * .5, m = (h - .5) * y;
 *   camera.position.set(0 + i*cos(r), 0 + i*sin(m), 4 + i*sin(r)*cos(m) - i);
 *   camera.lookAt(0, 0, 4 - i);
 *   // scroll-driven card rise + shader progress (p = section in-view progress):
 *   cardA.position.y = .4  + easeOutSine(clamp01((p - .8) / .2)) * 1.1;
 *   cardB.position.y = 1.2 + easeOutSine(clamp01((p - .8) / .2)) * 1.1;
 *   progress = -0.25 + 1.25 * easeInOutSine(p);
 *
 * The measured camera from webgl-scenes.json — pos (0.6412, -0.8657, 3.9274), rot
 * (0.1088, 0.0802, -0.0088) — is reproduced by that orbit for pointer
 * (0.2994, 0.2290) of the element, and the measured mesh uniforms (progress -0.25 with
 * the cards at their base y) are what p = 0 yields. Both are asserted in
 * tests/unit/webgl-scenes.spec.ts, so the scene is pinned to the capture rather than
 * eyeballed.
 */
import * as THREE from 'three';
import type { FrameInput, SceneController, SectionId } from '@/motion/motion.types';
import { WebGLHost } from './createWebGLHost';
import { textureRegistry } from './textureRegistry';
import nexusVert from './shaders/nexus.vert.glsl?raw';
import nexusFrag from './shaders/nexus.frag.glsl?raw';

interface NexusMeshSpec {
  position: [number, number, number];
  rotation: [number, number, number];
  scale: number;
  radius: number;
  offset: number;
  progressScale: number;
  alpha: number;
  textureUrl: string;
}

/** Mesh transforms + uniforms, verbatim from evidence/reference/webgl-scenes.json. */
const MESHES: readonly NexusMeshSpec[] = [
  {
    position: [-0.59, 0.4, 0.5],
    rotation: [0, 2.6, 0.4],
    scale: 1.3,
    radius: 1.96,
    offset: -0.48,
    progressScale: 1,
    alpha: 1,
    textureUrl: '/assets/cards/nexus/card-1.png',
  },
  {
    position: [-0.3, 1.2, -3.5],
    rotation: [0, -2.4, -0.41],
    scale: 1.8,
    radius: 0.87,
    offset: -1.04,
    progressScale: 1,
    alpha: 1,
    textureUrl: '/assets/cards/nexus/card-2.png',
  },
];

const CAMERA = {
  fov: 40.1792, // measured; the source asks the render lib for 30.65
  near: 0.1,
  far: 69,
  base: [0, 0, 4] as [number, number, number],
  orbitRadius: 8,
  swayAmplitude: 0.4,
};

/** Reference easings, from evidence/reference/raw/_nuxt/xAAeZd5K.js. */
const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v);
const easeInOutSine = (x: number): number => 0.5 * (1 - Math.cos(Math.PI * clamp01(x)));
const easeOutSine = (x: number): number => 1 - Math.cos(clamp01(x) * Math.PI / 2);

/** progress → { rise, shaderProgress } exactly as the reference watcher computes them. */
export function nexusScrollState(progress: number): { rise: number; shaderProgress: number } {
  const rise = easeOutSine(clamp01((progress - 0.8) / 0.2)) * 1.1;
  const shaderProgress = -0.25 + 1.25 * easeInOutSine(progress);
  return { rise, shaderProgress };
}

/** progress → the reference's pointer-driven camera pose (position + lookAt target). */
export function nexusCameraState(pointerNdc: { x: number; y: number }): {
  position: [number, number, number];
  target: [number, number, number];
} {
  const px = (pointerNdc.x + 1) / 2;
  const py = (pointerNdc.y + 1) / 2;
  const r = (px - 0.5) * CAMERA.swayAmplitude + Math.PI * 0.5;
  const m = (py - 0.5) * CAMERA.swayAmplitude;
  const i = CAMERA.orbitRadius;
  const [bx, by, bz] = CAMERA.base;
  return {
    position: [bx + i * Math.cos(r), by + i * Math.sin(m), bz + i * Math.sin(r) * Math.cos(m) - i],
    target: [0, 0, bz - i],
  };
}

export interface CurvedPanelOptions {
  canvas: HTMLCanvasElement;
  id?: SectionId;
}

export interface CurvedPanelSnapshot {
  cameraPosition: [number, number, number];
  cameraRotation: [number, number, number];
  meshPositions: [number, number, number][];
  shaderProgress: number[];
}

export interface CurvedPanelController extends SceneController {
  snapshot(): CurvedPanelSnapshot;
}

export function createCurvedPanel(options: CurvedPanelOptions): CurvedPanelController {
  const id = options.id ?? 'home.card';
  const host = new WebGLHost(options.canvas);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(CAMERA.fov, 1, CAMERA.near, CAMERA.far);
  camera.position.set(...CAMERA.base);

  const geometry = new THREE.PlaneGeometry(1, 2, 20, 20);
  const textureUrls: string[] = [];
  const meshRefs: Array<{ mesh: THREE.Mesh; uniforms: Record<string, THREE.IUniform>; base: number }> = [];

  for (const spec of MESHES) {
    textureUrls.push(spec.textureUrl);
    // The captured nexus fragment shader writes texture2D() straight to gl_FragColor
    // (no encode), so the map must not be hardware-decoded.
    const imageTexture = textureRegistry.acquire(spec.textureUrl, { colorSpace: 'none' });
    const uniforms: Record<string, THREE.IUniform> = {
      imageTexture: { value: imageTexture },
      progress: { value: -0.25 },
      progressScale: { value: spec.progressScale },
      offset: { value: spec.offset },
      radius: { value: spec.radius },
      alpha: { value: spec.alpha },
    };
    const material = new THREE.ShaderMaterial({
      uniforms,
      vertexShader: nexusVert,
      fragmentShader: nexusFrag,
      side: THREE.DoubleSide,
      transparent: true,
      depthWrite: true,
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(...spec.position);
    mesh.rotation.set(...spec.rotation);
    mesh.scale.setScalar(spec.scale);
    scene.add(mesh);
    meshRefs.push({ mesh, uniforms, base: spec.position[1] });
  }

  let disposed = false;

  const applyState = (frame: FrameInput, progress: number): void => {
    const p = clamp01(progress);
    const { rise, shaderProgress } = nexusScrollState(p);
    for (const ref of meshRefs) {
      ref.uniforms.progress!.value = shaderProgress;
      // CPU vertical drift, exactly the reference's `position.y = base + r * 1.1`.
      ref.mesh.position.y = ref.base + rise;
    }
    const pose = nexusCameraState(frame.reducedMotion ? { x: 0, y: 0 } : frame.pointerNdc);
    camera.position.set(...pose.position);
    camera.lookAt(pose.target[0], pose.target[1], pose.target[2]);
  };

  return {
    id,

    update(frame: FrameInput, progress: number): void {
      if (disposed) return;
      applyState(frame, progress);
      host.setViewport();
      host.render(scene, camera);
    },

    snapshot(): CurvedPanelSnapshot {
      return {
        cameraPosition: camera.position.toArray() as [number, number, number],
        cameraRotation: [camera.rotation.x, camera.rotation.y, camera.rotation.z],
        meshPositions: meshRefs.map((r) => r.mesh.position.toArray() as [number, number, number]),
        shaderProgress: meshRefs.map((r) => r.uniforms.progress!.value as number),
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
      for (const { mesh } of meshRefs) (mesh.material as THREE.Material).dispose();
      for (const url of textureUrls) textureRegistry.release(url);
      scene.clear();
      host.dispose();
    },
  };
}
