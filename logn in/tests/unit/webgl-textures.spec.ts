/**
 * @vitest-environment jsdom
 *
 * Requirement 4 of the WebGL brief: after `dispose()` on all three built scenes the
 * texture registry must report zero held references (no GPU texture leaks across route
 * changes). The registry is process-wide, so the test also proves the ref-counting is
 * balanced when two scenes share a URL.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { muteWebglLogs, stubCanvasContext } from './webgl-test-harness';
import { createCardRing } from '@/webgl/createCardRing';
import { textureRegistry } from '@/webgl/textureRegistry';
import { WEBGL_SECTIONS, canvasCountFor, createWebGLScene } from '@/webgl/sceneRegistry';

let restore: () => void = () => undefined;
beforeEach(() => {
  stubCanvasContext();
  restore = muteWebglLogs();
  textureRegistry.disposeAll();
});
afterEach(() => restore());

function canvases(n: number): HTMLCanvasElement[] {
  return Array.from({ length: n }, () => document.createElement('canvas'));
}

/** Build all three captured scenes through the registry, exactly like mountScenes does. */
function buildAllThree() {
  const [a, b] = canvases(2);
  const hero = createWebGLScene('home.hero', { kind: 'card-ring', canvases: [a, b] });
  const getSeen = createWebGLScene('home.get-seen', { kind: 'pointer-panel', canvas: canvases(1)[0] });
  const card = createWebGLScene('home.card', { kind: 'curved-panel', canvas: canvases(1)[0] });
  return [hero, getSeen, card].filter(Boolean) as NonNullable<ReturnType<typeof createWebGLScene>>[];
}

describe('texture registry discipline', () => {
  it('starts empty and holds exactly the 12 measured textures while the scenes live', () => {
    expect(textureRegistry.held()).toEqual([]);
    const scenes = buildAllThree();
    // 9 hero card maps (Card-1..9) + 2 nexus maps + 1 get-seen video preview.
    expect(textureRegistry.held().sort()).toEqual(
      [
        ...Array.from({ length: 9 }, (_, i) => `/assets/cards/Card-${i + 1}.png`),
        '/assets/cards/nexus/card-1.png',
        '/assets/cards/nexus/card-2.png',
        '/assets/product/video-preview.png',
      ].sort(),
    );
    expect(textureRegistry.referenceCount()).toBe(12);
    for (const s of scenes) s.dispose();
  });

  it('reports zero held references after dispose() on all three scenes', () => {
    const scenes = buildAllThree();
    expect(textureRegistry.referenceCount()).toBeGreaterThan(0);
    for (const s of scenes) s.dispose();
    expect(textureRegistry.held()).toEqual([]);
    expect(textureRegistry.referenceCount()).toBe(0);
  });

  it('is idempotent: disposing twice never releases a shared texture early', () => {
    const scenes = buildAllThree();
    for (const s of scenes) {
      s.dispose();
      s.dispose();
    }
    expect(textureRegistry.held()).toEqual([]);
  });

  it('ref-counts a URL shared by two scenes down to zero only on the last dispose', () => {
    const url = '/assets/cards/Card-1.png';
    const [a, b] = canvases(2);
    const [c, d] = canvases(2);
    // Both rings map all nine cards onto the same URL → 9 references per scene.
    const one = createCardRing({ canvases: [a, b], textureUrlFor: () => url });
    const two = createCardRing({ canvases: [c, d], textureUrlFor: () => url });
    expect(textureRegistry.held()).toEqual([url]);
    expect(textureRegistry.referenceCount()).toBe(18);
    one.dispose();
    expect(textureRegistry.held()).toEqual([url]);
    expect(textureRegistry.referenceCount()).toBe(9);
    two.dispose();
    expect(textureRegistry.held()).toEqual([]);
    expect(textureRegistry.referenceCount()).toBe(0);
  });

  it('builds every home section and rejects a mount kind that does not match the scene', () => {
    // No home section is left as a DOM poster: connectory and testimonials gained captured
    // shaders from their component sources (evidence/reference/webgl-scenes-corrected.md).
    expect(WEBGL_SECTIONS.filter((s) => !s.built).map((s) => s.sectionId)).toEqual([]);

    for (const id of ['home.connectory', 'home.testimonials']) {
      expect(canvasCountFor(id)).toBe(1);
      const [a] = canvases(1);
      // The mount kind is the scene's identity here: buildMount() once re-narrowed every
      // non-card-ring kind and these two silently drew zero frames as a result.
      expect(createWebGLScene(id, { kind: 'curved-panel', canvas: a })).toBeNull();
      expect(createWebGLScene(id, { kind: 'pointer-panel', canvas: a })).toBeNull();
    }

    const [c1] = canvases(1);
    const connectory = createWebGLScene('home.connectory', { kind: 'connectory-panel', canvas: c1 });
    expect(connectory).not.toBeNull();
    const [t1] = canvases(1);
    const carousel = createWebGLScene('home.testimonials', { kind: 'testimonial-carousel', canvas: t1 });
    expect(carousel).not.toBeNull();
    // Connectory holds its one curved panel; the carousel holds all eight review cards.
    expect(textureRegistry.held().length).toBeGreaterThan(1);
    connectory?.dispose();
    carousel?.dispose();
    expect(textureRegistry.held()).toEqual([]);
  });
});
