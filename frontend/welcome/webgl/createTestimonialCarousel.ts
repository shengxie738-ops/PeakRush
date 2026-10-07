/**
 * createTestimonialCarousel.ts — the `landing-9-testimonials` scene (home.testimonials).
 *
 * Transcribed from the reference component `Landing9TestimonialsWebGl`
 * (evidence/reference/raw/_nuxt/BsSV4kAi.js), whose vertex and fragment shaders are
 * inlined in that file and are stored verbatim as shaders/testimonials.*.glsl.
 *
 * This is a DRAG CAROUSEL, not a scroll-driven scene. `count` is 8 (the parent passes
 * `count:8`), each card being Plane(1,1,20,20) at scale 3.2, and the active index only
 * ever changes through the Prev/Next buttons or a pointer drag:
 *
 *   const L = 4.24, fe = 2.07;                       // flat radius, bent radius
 *   camera: { fov: 28, far: 69, position: [0,0,4], rotation: [0,0,0] }   // static
 *   card: { offset: -PI/2, progressScale: .87, radius: {value: L}, effect: {value: i?1:0} }
 *
 *   // W/E are the 7-slot position and rotation tracks (index 3 is the front slot):
 *   W = [[-22,-4.1,-29],[-10.6,-2.3,-23],[-3.9,2.5,-17],[0,0,0],[3.9,2.5,-17],[9.2,-1.4,-23],[22,-4.1,-29]]
 *   E = [[-.8,0,0],[.4,0,0],[-.6,0,0],[0,0,0],[-.6,0,0],[.4,0,0],[-.8,0,0]]
 *
 *   track(n, s) = lerp(s[floor(n)+3], s[ceil(n)+3], sin(h*PI/2)),
 *                 h = n > 0 ? |n| % 1 : 1 - |n| % 1
 *   layout(n, s) for card u:
 *     c = clamp(|n-u|, 0, 1)                 // 0 = front, 1 = flat/edge
 *     p = s * .2 * c                         // pointer-x parallax
 *     h = u - n - p
 *     |h| > 3          -> visible = false
 *     else             -> progress.x = (n-u)*-1, position = track(h,W), rotation = track(h,E),
 *                         effect = c, radius = remap(c, 0,1 -> L,fe)
 *   initial call is layout(0, .5).
 *
 * `effect` is what the bend shader mixes on: 0 renders the card flat
 * (`pointBase`), 1 renders it wrapped on the cylinder (`point`), and the radius
 * simultaneously relaxes 4.24 -> 2.07. So an edge card is flat and a front card is
 * strongly curved — the opposite of what a naive "always bend" implementation gives.
 *
 * The index tween's 1000 ms duration and .002 precision come from the source
 * (`Y(f,{precision:.002,time:1e3})`); its curve shape is NOT captured, so it is
 * implemented here as an ease-in-out and marked DERIVED.
 */
import * as THREE from 'three';
import type { FrameInput, SceneController, SectionId } from '@/motion/motion.types';
import { WebGLHost } from './createWebGLHost';
import { textureRegistry } from './textureRegistry';
import testimonialsVert from './shaders/testimonials.vert.glsl?raw';
import testimonialsFrag from './shaders/testimonials.frag.glsl?raw';

const FLAT_RADIUS = 4.24;
const BENT_RADIUS = 2.07;
const OFFSET = Math.PI * -0.5;
const PROGRESS_SCALE = 0.87;
const CARD_SCALE = 3.2;
const PARALLAX = 0.2;
/** Seconds; the reference uses a 1e3 ms tween. Curve shape is DERIVED. */
const TWEEN_SEC = 1;

type Vec3 = [number, number, number];

const W: readonly Vec3[] = [
  [-22, -4.1, -29], [-10.6, -2.3, -23], [-3.9, 2.5, -17], [0, 0, 0],
  [3.9, 2.5, -17], [9.2, -1.4, -23], [22, -4.1, -29],
];
const E: readonly Vec3[] = [
  [-0.8, 0, 0], [0.4, 0, 0], [-0.6, 0, 0], [0, 0, 0],
  [-0.6, 0, 0], [0.4, 0, 0], [-0.8, 0, 0],
];

const clamp = (v: number, lo: number, hi: number): number => (v < lo ? lo : v > hi ? hi : v);

/** The reference's `M(n,s)`, including its out-of-range fallbacks. */
export function slotTrack(n: number, tracks: readonly Vec3[]): Vec3 {
  const lo = Math.floor(n) + 3;
  const hi = Math.ceil(n) + 3;
  const a = tracks[lo];
  const b = tracks[hi];
  if (!a) return tracks[0];
  if (!b) return tracks[tracks.length - 1];
  const h = n > 0 ? Math.abs(n) % 1 : 1 - (Math.abs(n) % 1);
  const d = Math.sin(h * Math.PI * 0.5);
  return [
    a[0] + (b[0] - a[0]) * d,
    a[1] + (b[1] - a[1]) * d,
    a[2] + (b[2] - a[2]) * d,
  ];
}

export interface CardLayout {
  visible: boolean;
  position: Vec3;
  rotation: Vec3;
  progressX: number;
  effect: number;
  radius: number;
}

/** The reference's `m(n,s)` for one card `u`. */
export function cardLayout(index: number, pointerX: number, u: number): CardLayout {
  const c = clamp(Math.abs(index - u), 0, 1);
  const p = pointerX * PARALLAX * c;
  const h = u - index - p;
  if (h < -3 || h > 3) {
    return { visible: false, position: [0, 0, 0], rotation: [0, 0, 0], progressX: 0, effect: c, radius: FLAT_RADIUS };
  }
  return {
    visible: true,
    position: slotTrack(h, W),
    rotation: slotTrack(h, E),
    progressX: (index - u) * -1,
    effect: c,
    radius: FLAT_RADIUS + (BENT_RADIUS - FLAT_RADIUS) * c,
  };
}

const reviewUrl = (i: number): string => `/assets/decor/Review-${i + 1}.png`;

export interface TestimonialCarouselOptions {
  canvas: HTMLCanvasElement;
  count?: number;
  id?: SectionId;
}

export interface TestimonialSnapshot {
  activeIndex: number;
  cameraPosition: [number, number, number];
  cards: CardLayout[];
}

export function createTestimonialCarousel(options: TestimonialCarouselOptions): SceneController {
  const id = options.id ?? 'home.testimonials';
  const count = options.count ?? 8;
  const host = new WebGLHost(options.canvas);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(28, 1, 0.1, 69);
  camera.position.set(0, 0, 4);

  const geometry = new THREE.PlaneGeometry(1, 1, 20, 20);
  const urls: string[] = [];
  const cards: Array<{
    mesh: THREE.Mesh;
    material: THREE.ShaderMaterial;
    uniforms: Record<string, THREE.IUniform>;
  }> = [];

  for (let i = 0; i < count; i++) {
    const url = reviewUrl(i);
    urls.push(url);
    const uniforms: Record<string, THREE.IUniform> = {
      imageTexture: { value: textureRegistry.acquire(url, { colorSpace: 'none' }) },
      // Per-card uniform objects, exactly as the reference builds them inside Promise.all.
      progress: { value: new THREE.Vector2(0, 0) },
      radius: { value: FLAT_RADIUS },
      offset: { value: OFFSET },
      progressScale: { value: PROGRESS_SCALE },
      effect: { value: i === 0 ? 0 : 1 },
    };
    const material = new THREE.ShaderMaterial({
      uniforms,
      vertexShader: testimonialsVert,
      fragmentShader: testimonialsFrag,
      side: THREE.DoubleSide,
      transparent: true,
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.frustumCulled = false;
    mesh.scale.setScalar(CARD_SCALE);
    scene.add(mesh);
    cards.push({ mesh, material, uniforms });
  }

  let disposed = false;
  let target = 0;
  let shown = 0;
  let tweenFrom = 0;
  let tweenStart = -1;

  const goTo = (next: number): void => {
    const clamped = clamp(Math.round(next), 0, count - 1);
    if (clamped === target) return;
    target = clamped;
    tweenFrom = shown;
    tweenStart = -1;
  };

  /* --- interaction: Prev/Next + horizontal drag, matching the reference's handlers --- */
  const container = options.canvas.parentElement;
  const onPrev = (): void => goTo(target - 1);
  const onNext = (): void => goTo(target + 1);
  let dragging = false;
  let dragStartX = 0;
  let dragFromIndex = 0;
  const onPointerDown = (e: PointerEvent): void => {
    if ((e.target as HTMLElement).closest('a, .btn')) return;
    dragging = true;
    dragStartX = e.clientX;
    dragFromIndex = target;
    container?.classList.add('is-dragging');
    options.canvas.setPointerCapture?.(e.pointerId);
  };
  const onPointerUp = (e: PointerEvent): void => {
    if (!dragging) return;
    dragging = false;
    container?.classList.remove('is-dragging');
    const dx = e.clientX - dragStartX;
    // The reference snaps on inertia, falling back to nearest-int rounding of the drag.
    const moved = Math.abs(dx) >= 10 ? Math.round(-dx / slotWidth()) : 0;
    goTo(dragFromIndex + moved);
  };
  const slotWidth = (): number => (container?.clientWidth || window.innerWidth) / 1460 * 460;

  container?.addEventListener('click', (e) => {
    const btn = (e.target as HTMLElement).closest('[data-carousel-step]');
    if (!btn) return;
    if (btn.getAttribute('data-carousel-step') === 'next') onNext();
    else onPrev();
  });
  options.canvas.addEventListener('pointerdown', onPointerDown);
  options.canvas.addEventListener('pointerup', onPointerUp);
  options.canvas.addEventListener('pointercancel', onPointerUp);

  const easeInOut = (t: number): number => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);

  return Object.assign(
    {
      id,

      update(frame: FrameInput, _progress: number): void {
        if (disposed) return;
        if (tweenStart < 0) tweenStart = frame.timeSec;
        const t = clamp((frame.timeSec - tweenStart) / TWEEN_SEC, 0, 1);
        shown = frame.reducedMotion ? target : tweenFrom + (target - tweenFrom) * easeInOut(t);

        const pointerX = frame.reducedMotion ? 0.5 : (frame.pointerNdc.x + 1) / 2;
        cards.forEach((card, u) => {
          const l = cardLayout(shown, pointerX, u);
          card.mesh.visible = l.visible;
          if (!l.visible) return;
          card.mesh.position.set(l.position[0], l.position[1], l.position[2]);
          card.mesh.rotation.set(l.rotation[0], l.rotation[1], l.rotation[2]);
          (card.uniforms.progress!.value as THREE.Vector2).x = l.progressX;
          card.uniforms.effect!.value = l.effect;
          card.uniforms.radius!.value = l.radius;
        });

        host.setViewport();
        host.render(scene, camera);
      },

      snapshot(): TestimonialSnapshot {
        return {
          activeIndex: target,
          cameraPosition: camera.position.toArray() as [number, number, number],
          cards: cards.map((_, u) => cardLayout(shown, 0.5, u)),
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
        options.canvas.removeEventListener('pointerdown', onPointerDown);
        options.canvas.removeEventListener('pointerup', onPointerUp);
        options.canvas.removeEventListener('pointercancel', onPointerUp);
        geometry.dispose();
        for (const { material } of cards) material.dispose();
        for (const url of urls) textureRegistry.release(url);
        scene.clear();
        host.dispose();
      },
    },
    { goTo },
  );
}
