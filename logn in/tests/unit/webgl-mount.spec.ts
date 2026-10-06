/**
 * @vitest-environment jsdom
 *
 * Regression test for the `live=0` bug: App.vue registers scenes once, in `onMounted`,
 * while every route (and therefore every section canvas) is a lazy `import()`. The
 * WebGL layer must therefore discover its mounts late, when the section finally
 * appears — and must never invent scenes that were never captured.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { muteWebglLogs, stubCanvasContext } from './webgl-test-harness';

// Armed BEFORE the module graph is evaluated so the auto-observer never starts here.
(window as unknown as Record<string, unknown>).__FOLLOW_WEBGL_NO_AUTOMOUNT__ = true;
stubCanvasContext();

const { discoverMounts, tryMountPending, webGLMountState, disposeWebGLScenes, scrollRangeFor } = await import(
  '@/webgl/mountScenes'
);

function heroDom(): void {
  document.body.innerHTML = `
    <div class="scrollable scrollable--root">
      <div class="scrollable__area lenis">
        <div class="scrollable__area-inner">
          <section data-section-id="home.hero">
            <div class="landing-1-intro-webgl">
              <div class="landing-1-intro-webgl__canvas-wrapper" data-webgl="pending">
                <span class="webgl-fallback"><img alt="" /></span>
                <canvas></canvas><canvas></canvas>
              </div>
            </div>
          </section>
          <section data-section-id="home.get-seen">
            <div class="landing-2-get-seen-webgl" data-webgl="pending"><canvas></canvas></div>
          </section>
          <section data-section-id="home.card">
            <div class="landing-5-nexus-webgl">
              <div class="landing-5-nexus-webgl__content" data-webgl="pending"><canvas></canvas></div>
            </div>
          </section>
          <section data-section-id="home.testimonials">
            <div class="landing-9-testimonials-webgl"><canvas></canvas></div>
          </section>
          <section data-section-id="home.connectory">
            <div class="landing-7-connectory-webgl"><canvas></canvas></div>
          </section>
        </div>
      </div>
    </div>`;
}

let restore: () => void = () => undefined;
beforeEach(() => {
  restore = muteWebglLogs();
  disposeWebGLScenes();
  document.body.innerHTML = '';
});
afterEach(() => restore());

describe('late mount discovery', () => {
  it('finds nothing before the route chunk has rendered (the App.vue onMounted moment)', () => {
    expect(discoverMounts()).toHaveLength(0);
    expect(tryMountPending()).toBe(false);
    expect(webGLMountState().mounted).toEqual([]);
    expect(webGLMountState().pending.sort()).toEqual([
      'home.card', 'home.connectory', 'home.get-seen', 'home.hero', 'home.testimonials',
    ]);
  });

  it('mounts all five captured scenes once the sections exist, even though they arrived late', () => {
    heroDom();
    expect(tryMountPending()).toBe(true);
    const state = webGLMountState();
    expect(state.mounted.sort()).toEqual([
      'home.card', 'home.connectory', 'home.get-seen', 'home.hero', 'home.testimonials',
    ]);
    expect(state.pending).toEqual([]);
  });

  it('marks each host live and hides the static poster so the canvas is visible', async () => {
    heroDom();
    tryMountPending();
    // The live flag is set after the first rendered frame (one rAF, or synchronously
    // where rAF is unavailable).
    await new Promise<void>((resolve) => {
      if (typeof requestAnimationFrame === 'function') requestAnimationFrame(() => resolve());
      else setTimeout(() => resolve(), 0);
    });
    for (const host of Array.from(document.querySelectorAll<HTMLElement>('[data-webgl]'))) {
      // home.card's outer element keeps its own binding; the mount host is the one that
      // must be flipped to live.
      if (host.classList.contains('landing-5-nexus-webgl')) continue;
      expect(host.getAttribute('data-webgl'), host.className).toBe('live');
    }
    for (const poster of Array.from(document.querySelectorAll<HTMLElement>('.webgl-fallback'))) {
      expect(poster.style.display).toBe('none');
    }
  });

  it('mounts the connectory and testimonials scenes instead of leaving them as posters', async () => {
    heroDom();
    tryMountPending();
    const mounted = webGLMountState().mounted;
    expect(mounted).toContain('home.testimonials');
    expect(mounted).toContain('home.connectory');
    // The live flag is set after the first rendered frame, like every other host.
    await new Promise<void>((resolve) => {
      if (typeof requestAnimationFrame === 'function') requestAnimationFrame(() => resolve());
      else setTimeout(() => resolve(), 0);
    });
    expect(document.querySelector('.landing-9-testimonials-webgl')?.getAttribute('data-webgl')).toBe('live');
    expect(document.querySelector('.landing-7-connectory-webgl')?.getAttribute('data-webgl')).toBe('live');
  });

  it('waits for the second hero canvas instead of mounting a half-ready scene', () => {
    document.body.innerHTML = `
      <div class="scrollable__area"><section data-section-id="home.hero">
        <div class="landing-1-intro-webgl__canvas-wrapper"><canvas></canvas></div>
      </section></div>`;
    expect(tryMountPending()).toBe(false);
    expect(webGLMountState().mounted).toEqual([]);
    document.querySelector('.landing-1-intro-webgl__canvas-wrapper')!.appendChild(document.createElement('canvas'));
    tryMountPending();
    expect(webGLMountState().mounted).toEqual(['home.hero']);
  });

  it('disposes cleanly through the mount layer', () => {
    heroDom();
    tryMountPending();
    expect(() => disposeWebGLScenes()).not.toThrow();
    expect(webGLMountState().mounted).toEqual([]);
  });
});

describe('scroll range derivation', () => {
  it('matches App.vue: start = top - viewport, end = top + viewport', () => {
    heroDom();
    const container = document.querySelector<HTMLElement>('.scrollable__area')!;
    const section = document.querySelector<HTMLElement>('[data-section-id="home.hero"]')!;
    Object.defineProperty(container, 'clientHeight', { value: 900, configurable: true });
    const range = scrollRangeFor(section, container);
    expect(range.endPx - range.startPx).toBeGreaterThanOrEqual(900);
    expect(range.startPx).toBeGreaterThanOrEqual(0);
  });
});
