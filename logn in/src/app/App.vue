<script setup lang="ts">
/**
 * App.vue — the reference scroll shell + the WebGL scene wiring.
 *
 * Scroll model (evidence/reference-lock.json, restated in src/styles/layout.css §1
 * and docs/DOM_CONTRACT.md line 20): the document itself does not scroll
 * (`html,body{overflow:clip}` via `body:has(.scrollable--root)`), instead a
 * position:fixed root holds a `.scrollable__area` that is the real scroll container
 * (measured containerScrollHeight 7563 at 1376x772) and Lenis is bound to it.
 * The DOM this component renders is the measured one:
 *
 *   <div class="scrollable scrollable--root" style="background-color:…">
 *     <div class="scrollable__area lenis">
 *       <div class="scrollable__area-inner"> … header, page, #lenis-teleports … </div>
 *     </div>
 *     <div class="scrollable__scrollbar scrollbar …">…</div>
 *
 * Motion: `createMotionRuntime({container})` from @/motion/createMotionRuntime is
 * created once on mount and disposed on unmount; every WebGL section of the page is
 * registered with its scroll range. The module is being written concurrently, so it
 * is resolved through import.meta.glob — that keeps `vite build` green while the
 * file is absent and picks it up the moment it lands, with the alias resolved by
 * Vite rather than by hand.
 */
import { computed, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue';
import { useRoute } from 'vue-router';
import SiteHeader from '@/components/SiteHeader.vue';
import CookieConsent from '@/components/CookieConsent.vue';
import FixedSignUpButton from '@/components/FixedSignUpButton.vue';
import { ICON_SPRITE } from '@/content/assetRegistry';
import { WEBGL_SECTIONS, canvasCountFor, createWebGLScene } from '@/webgl/sceneRegistry';
import type { MotionRuntime, SceneController, ScrollRange } from '@/motion/motion.types';
import type { WebGLMount } from '@/webgl/sceneRegistry';
import { SEO } from '@/content/home';

interface RuntimeFactory {
  (options?: { container?: HTMLElement }): MotionRuntime;
}

const THEME_COLORS: Record<string, string> = {
  light: '#FFFFFF',
  dark: '#000000',
  orange: '#F4793A',
  blue: '#8498AC',
  pink: '#C5939D',
  green: '#8E9487',
};

/**
 * sectionId → the DOM node that must receive the canvas. The class names come from
 * the captured WebGL chunks (Landing1IntroWebGl.DZK6hbZ4.css,
 * Landing5NexusWebGl.DUcfhe4o.css and wH0WNvJv.js for landing-2), i.e. the element
 * the reference hands to its renderer is the element this clone hands the scene to.
 */
const MOUNT_BY_SCENE: Record<string, { selector: string; kind: WebGLMount['kind'] }> = {
  'landing-1-intro': { selector: '.landing-1-intro-webgl__canvas-wrapper', kind: 'card-ring' },
  'landing-2-get-seen': { selector: '.landing-2-get-seen-webgl', kind: 'pointer-panel' },
  'landing-5-nexus': { selector: '.landing-5-nexus-webgl__content', kind: 'curved-panel' },
  'landing-7-connectory': { selector: '.landing-7-connectory-webgl', kind: 'connectory-panel' },
  'landing-9-testimonials': { selector: '.landing-9-testimonials-webgl', kind: 'testimonial-carousel' },
};

const runtimeModules = import.meta.glob<{ createMotionRuntime?: RuntimeFactory }>(
  '/src/motion/createMotionRuntime.ts',
);

const route = useRoute();
const scrollArea = ref<HTMLElement | null>(null);
const root = shallowRef<MotionRuntime | null>(null);
const scenes = new Map<string, SceneController>();

const theme = computed<string>(() => (route.meta.theme as string) ?? 'light');
const rootStyle = computed(() => ({ backgroundColor: THEME_COLORS[theme.value] ?? '#FFFFFF' }));
const documentTitle = computed<string>(() => (route.meta.title as string) ?? SEO.title);
const reducedMotion =
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

watch(
  documentTitle,
  (value) => {
    document.title = value;
  },
  { immediate: true },
);

/**
 * Scroll range for one section.
 * Derived, not invented: webgl-scenes.json + the captured components map the
 * section's viewport-relative top through `G(top, +100svh, -100svh, 0, 1)` —
 * progress 0 when the section top sits one viewport below the fold, 1 when it has
 * travelled one viewport past the top. In scroll coordinates that is
 * start = sectionTop - viewportHeight, end = sectionTop + viewportHeight.
 */
function rangeFor(element: HTMLElement, container: HTMLElement): ScrollRange {
  const top = element.getBoundingClientRect().top + container.scrollTop;
  const span = container.clientHeight || window.innerHeight;
  return { startPx: Math.max(0, top - span), endPx: top + span };
}

function mountFor(sectionId: string, sceneName: string): { mount: WebGLMount; host: HTMLElement; section: HTMLElement } | null {
  const spec = MOUNT_BY_SCENE[sceneName];
  if (!spec) return null;
  const section = document.querySelector<HTMLElement>('[data-section-id="' + sectionId + '"]');
  if (!section) return null;
  const host = section.querySelector<HTMLElement>(spec.selector);
  if (!host) return null;
  const canvases = Array.from(host.querySelectorAll('canvas')) as HTMLCanvasElement[];
  const wanted = canvasCountFor(sectionId);
  if (canvases.length === 0 || canvases.length < wanted) return null;
  if (spec.kind === 'card-ring') {
    return { mount: { kind: 'card-ring', canvases: [canvases[0], canvases[1]] }, host, section };
  }
  return { mount: { kind: spec.kind, canvas: canvases[0] }, host, section };
}

async function registerScenes(runtime: MotionRuntime): Promise<void> {
  const container = scrollArea.value;
  if (!container) return;
  for (const meta of WEBGL_SECTIONS) {
    if (!meta.built) continue;
    const resolved = mountFor(meta.sectionId, meta.sceneName);
    if (!resolved) continue;
    const scene = createWebGLScene(meta.sectionId, resolved.mount);
    if (!scene) continue;
    scenes.set(meta.sectionId, scene);
    runtime.register(scene, rangeFor(resolved.section, container));
    /* CLONE-LOCAL "first successful frame" signal: SceneController exposes no frame
       callback, so the poster is dropped after the runtime has had two animation
       frames to render the scene. `data-webgl` is owned here (never bound by the
       section components) so Vue re-renders cannot reset it. */
    const host = resolved.host;
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        if (scenes.has(meta.sectionId)) host.setAttribute('data-webgl', 'live');
      });
    });
  }
}

onMounted(async () => {
  syncScrollbar();
  scrollArea.value?.addEventListener('scroll', syncScrollbar, { passive: true });
  window.addEventListener('resize', syncScrollbar);

  /* the reference mounts its SVG sprite and teleports outside the scroll area */
  const loader = runtimeModules['/src/motion/createMotionRuntime.ts'];
  if (!loader) {
    if (import.meta.env.DEV) {
      console.warn('[clone] @/motion/createMotionRuntime is not on disk yet — WebGL scenes stay on their static posters.');
    }
    return;
  }
  if (reducedMotion) return;
  const module = await loader();
  const factory = module.createMotionRuntime;
  if (typeof factory !== 'function') return;
  const runtime = factory({ container: scrollArea.value ?? undefined });
  root.value = runtime;
  await registerScenes(runtime);
});

onBeforeUnmount(() => {
  for (const id of scenes.keys()) root.value?.unregister(id);
  scenes.clear();
  root.value?.dispose();
  root.value = null;
  const container = scrollArea.value;
  if (container) container.removeEventListener('scroll', syncScrollbar);
  if (scrollbarFrame) window.cancelAnimationFrame(scrollbarFrame);
});

/* The reference paints its own scrollbar (Scrollable + Scrollbar in Bi84onXO.js:
   <div class="scrollbar"><div class="scrollbar__position" style="transform:
   translateY((1-height)*position*100%)"><div class="scrollbar__thumb"
   style="height:height*100%">). height and position are the same two ratios. */
const thumbStyle = ref<Record<string, string>>({ height: '100%' });
const positionStyle = ref<Record<string, string>>({ transform: 'translateY(0%)' });
let scrollbarFrame = 0;

function syncScrollbar(): void {
  if (scrollbarFrame) return;
  scrollbarFrame = window.requestAnimationFrame(() => {
    scrollbarFrame = 0;
    const container = scrollArea.value;
    if (!container) return;
    const scrollable = container.scrollHeight - container.clientHeight;
    const height = scrollable > 0 ? container.clientHeight / container.scrollHeight : 1;
    const position = scrollable > 0 ? container.scrollTop / scrollable : 0;
    thumbStyle.value = { height: `${height * 100}%` };
    positionStyle.value = { transform: `translateY(${(1 - height) * position * 100}%)` };
  });
}
</script>

<template>
  <div class="scrollable scrollable--root" :style="rootStyle">
    <div ref="scrollArea" class="scrollable__area lenis">
      <div class="scrollable__area-inner">
        <SiteHeader
          :theme="theme"
          :default-expanded="Boolean(route.meta.headerExpanded)"
          has-loading-state
          :loading="false"
        />
        <main>
          <RouterView />
        </main>
        <div id="lenis-teleports" />
      </div>
    </div>
    <div class="scrollable__scrollbar scrollbar" aria-hidden="true">
      <div class="scrollbar__position">
        <div class="scrollbar__thumb" />
      </div>
    </div>
  </div>

  <!-- reference modal / cookie mount point -->
  <div id="teleports" />

  <!-- CLONE-LOCAL: the reference loads /_nuxt/icons.g7tMF2ID.svg for
       <use href="#icon">; the 13 symbols this clone uses are inlined verbatim in
       src/content/assetRegistry.ts so no request is made. -->
  <div class="clone-icon-sprite" aria-hidden="true" v-html="'<svg xmlns=&quot;http://www.w3.org/2000/svg&quot;>' + ICON_SPRITE + '</svg>'" />

  <CookieConsent />
  <FixedSignUpButton />
</template>

<style>
/* CLONE-LOCAL helper: hidden sprite host + canvas placement inside WebGL mounts.
   The reference renderer appends its canvas with inline width/height, so the canvas
   is taken out of flow here and the reference DOM element keeps the layout size. */
.clone-icon-sprite {
  display: none;
}
.landing-1-intro-webgl__canvas-wrapper,
.landing-5-nexus-webgl__content,
.landing-9-testimonials-webgl,
.landing-7-connectory-webgl {
  position: absolute;
}
.landing-1-intro-webgl__canvas-wrapper,
.landing-5-nexus-webgl__content {
  inset: 0;
  position: relative;
}
.landing-1-intro-webgl canvas,
.landing-5-nexus-webgl canvas,
.landing-9-testimonials-webgl canvas,
.landing-7-connectory-webgl canvas {
  display: block;
  height: 100%;
  inset: 0;
  position: absolute;
  width: 100%;
}
</style>
