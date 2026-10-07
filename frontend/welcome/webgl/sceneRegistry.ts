/**
 * sceneRegistry.ts — maps a measured `sectionId` to its WebGL SceneController.
 *
 * The motion runtime owns scroll → progress and calls `register(scene)`. This module
 * is the only place that knows which sections have a captured scene and how to build
 * one from its canvas element(s). It never queries the DOM itself — that lives in
 * `mountScenes.ts`, which is armed from here (module scope) so discovery starts before
 * the lazily-imported route components exist.
 *
 * Reference facts (docs/DOM_CONTRACT.md):
 *   home.hero        → landing-1-intro   (2 canvases, depth-split ring)
 *   home.get-seen    → landing-2-get-seen(1 canvas, pointer plane)
 *   home.card        → landing-5-nexus   (1 canvas, 2-card curved panel)
 *   home.connectory  → landing-7         (1 canvas, 1 curved panel, scroll + pointer)
 *   home.testimonials→ landing-9         (1 canvas, 8-card drag carousel)
 *
 * All five are built from captured shader source. Note that
 * evidence/reference/scenes-measured.json transposes the connectory and testimonials
 * parameter sets; the component sources and the downloaded texture aspects settle it
 * — see evidence/reference/webgl-scenes-corrected.md.
 */
import type { SceneController, SectionId } from '@/motion/motion.types';
import { createCardRing, type CardRingOptions } from './createCardRing';
import { createCurvedPanel, type CurvedPanelOptions } from './createCurvedPanel';
import { createPointerPanel, type PointerPanelOptions } from './createPointerPanel';
import { createConnectoryPanel } from './createConnectoryPanel';
import { createTestimonialCarousel } from './createTestimonialCarousel';

export type WebGLMount =
  | { kind: 'card-ring'; canvases: readonly [HTMLCanvasElement, HTMLCanvasElement] }
  | { kind: 'curved-panel'; canvas: HTMLCanvasElement }
  | { kind: 'pointer-panel'; canvas: HTMLCanvasElement }
  | { kind: 'connectory-panel'; canvas: HTMLCanvasElement }
  | { kind: 'testimonial-carousel'; canvas: HTMLCanvasElement };

export interface WebGLSectionMeta {
  sectionId: SectionId;
  sceneName: string;
  canvasCount: number;
  built: boolean;
  /** Populated when built === false (why the clone can't reproduce it yet). */
  reason?: string;
}

export const WEBGL_SECTIONS: readonly WebGLSectionMeta[] = [
  { sectionId: 'home.hero', sceneName: 'landing-1-intro', canvasCount: 2, built: true },
  { sectionId: 'home.get-seen', sceneName: 'landing-2-get-seen', canvasCount: 1, built: true },
  { sectionId: 'home.card', sceneName: 'landing-5-nexus', canvasCount: 1, built: true },
  { sectionId: 'home.testimonials', sceneName: 'landing-9-testimonials', canvasCount: 1, built: true },
  { sectionId: 'home.connectory', sceneName: 'landing-7-connectory', canvasCount: 1, built: true },
];

/**
 * sceneName → the element that hosts the canvas + which mount shape it takes. The class
 * names come from the captured WebGL chunks (Landing1IntroWebGl.DZK6hbZ4.css,
 * Landing5NexusWebGl.DUcfhe4o.css, wH0WNvJv.js) and are the same ones App.vue's
 * `MOUNT_BY_SCENE` uses; keeping the map here means the WebGL layer can discover its
 * own mounts without the app being online at the right moment.
 */
export const MOUNT_SPEC_BY_SCENE: Record<string, { selector: string; kind: WebGLMount['kind'] }> = {
  'landing-1-intro': { selector: '.landing-1-intro-webgl__canvas-wrapper', kind: 'card-ring' },
  'landing-2-get-seen': { selector: '.landing-2-get-seen-webgl', kind: 'pointer-panel' },
  'landing-5-nexus': { selector: '.landing-5-nexus-webgl__content', kind: 'curved-panel' },
  'landing-7-connectory': { selector: '.landing-7-connectory-webgl', kind: 'connectory-panel' },
  'landing-9-testimonials': { selector: '.landing-9-testimonials-webgl', kind: 'testimonial-carousel' },
};

type FactoryOptions = Partial<Omit<CardRingOptions, 'canvases' | 'id'>> &
  Partial<Omit<CurvedPanelOptions, 'canvas' | 'id'>> &
  Partial<Omit<PointerPanelOptions, 'canvas' | 'id'>>;

/** Build a SceneController for `sectionId`, or null if no captured scene exists. */
export function createWebGLScene(
  sectionId: SectionId,
  mount: WebGLMount,
  options: FactoryOptions = {},
): SceneController | null {
  const meta = WEBGL_SECTIONS.find((s) => s.sectionId === sectionId);
  if (!meta || !meta.built) return null;

  switch (meta.sceneName) {
    case 'landing-1-intro': {
      if (mount.kind !== 'card-ring') return null;
      return createCardRing({ ...options, canvases: mount.canvases, id: sectionId });
    }
    case 'landing-5-nexus': {
      if (mount.kind !== 'curved-panel') return null;
      return createCurvedPanel({ ...options, canvas: mount.canvas, id: sectionId });
    }
    case 'landing-2-get-seen': {
      if (mount.kind !== 'pointer-panel') return null;
      return createPointerPanel({ ...options, canvas: mount.canvas, id: sectionId });
    }
    case 'landing-7-connectory': {
      if (mount.kind !== 'connectory-panel') return null;
      return createConnectoryPanel({ canvas: mount.canvas, id: sectionId });
    }
    case 'landing-9-testimonials': {
      if (mount.kind !== 'testimonial-carousel') return null;
      return createTestimonialCarousel({ canvas: mount.canvas, id: sectionId, count: 8 });
    }
    default:
      return null;
  }
}

/** Convenience: how many canvases a section needs (for DOM wiring). */
export function canvasCountFor(sectionId: SectionId): number {
  return WEBGL_SECTIONS.find((s) => s.sectionId === sectionId)?.canvasCount ?? 0;
}

/* Importing this module is what arms the mount watcher: App.vue and every section
   component import it, so it runs before any canvas exists in the DOM. The import is
   dynamic on purpose — `mountScenes` statically imports this module for its section
   table, so a static edge back would leave one of the two half-initialised. Idempotent,
   and opt-out with `window.__FOLLOW_WEBGL_NO_AUTOMOUNT__ = true` (unit tests). */
void import('./mountScenes')
  .then((m) => m.ensureWebGLAutoMount())
  .catch(() => undefined);

export type { DiscoveredMount, MountedScene, MountOptions } from './mountScenes';
