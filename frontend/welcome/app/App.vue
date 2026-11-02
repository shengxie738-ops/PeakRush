<script setup lang="ts">
/** One scroll shell; App activates homepage WebGL and owns its route lifecycle. */
import { computed, nextTick, onBeforeUnmount, onMounted, provide, ref, shallowRef, watch } from 'vue';
import { useRoute } from 'vue-router';
import SiteHeader from '@/components/SiteHeader.vue';
import EditorialHeader from '@/components/EditorialHeader.vue';
import CookieConsent from '@/components/CookieConsent.vue';
import FixedSignUpButton from '@/components/FixedSignUpButton.vue';
import { ICON_SPRITE } from '@/content/assetRegistry';
import { disposeWebGLScenes, mountWebGLScenes } from '@/webgl/mountScenes';
import type { MotionRuntime } from '@/motion/motion.types';
import { SEO } from '@/content/home';
import { EDITORIAL_SCROLL, type EditorialScroll } from './editorialScroll';

const THEME_COLORS: Record<string, string> = {
  light: '#FFFFFF',
  dark: '#000000',
  orange: '#F4793A',
  blue: '#8498AC',
  pink: '#C5939D',
  green: '#8E9487',
};

const route = useRoute();
const scrollArea = ref<HTMLElement | null>(null);
const root = shallowRef<MotionRuntime | null>(null);
let mounted = false;
let disposed = false;
let lifecycleVersion = 0;

const theme = computed<string>(() => (route.meta.theme as string) ?? 'light');
const editorialNames = new Set(['about', 'our-product', 'community-board', 'pricing', 'faq']);
const editorialRoute = computed(() => typeof route.name === 'string' && editorialNames.has(route.name));
const rootStyle = computed(() => ({ backgroundColor: editorialRoute.value ? '#f7f7f2' : THEME_COLORS[theme.value] ?? '#FFFFFF' }));
const documentTitle = computed<string>(() => (route.meta.title as string) ?? SEO.title);
const reduceQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
const reducedMotion = ref(reduceQuery.matches);

watch(
  documentTitle,
  (value) => {
    document.title = value;
  },
  { immediate: true },
);

const scrollTo: EditorialScroll = (target, offset = 0) => {
  if (root.value) {
    root.value.scrollTo(target, offset);
    return;
  }
  const container = scrollArea.value;
  if (!container) return;
  const top = typeof target === 'number' ? target : target.getBoundingClientRect().top - container.getBoundingClientRect().top + container.scrollTop;
  container.scrollTo({ top: top + offset, behavior: 'instant' });
};
provide(EDITORIAL_SCROLL, scrollTo);

/* Every route change is a new document view, not a position restore: the shared
   container must start at the top or the previous page's scrollTop can clamp the
   new page to its bottom. */
watch(() => route.name, async () => {
  await nextTick();
  scrollTo(0);
  syncScrollbar();
});

function releaseScenes(): void {
  disposeWebGLScenes();
  root.value?.dispose();
  root.value = null;
}

async function syncScenes(): Promise<void> {
  const version = ++lifecycleVersion;
  releaseScenes();
  if (!mounted || disposed || reducedMotion.value || route.name !== 'home') return;
  await nextTick();
  if (version !== lifecycleVersion || disposed || reducedMotion.value || route.name !== 'home') return;
  if (!root.value) {
    const { createMotionRuntime } = await import('@/motion/createMotionRuntime');
    if (version !== lifecycleVersion || disposed || reducedMotion.value || route.name !== 'home') return;
    root.value = createMotionRuntime({ container: scrollArea.value ?? undefined });
  }
  mountWebGLScenes(root.value, { container: scrollArea.value, allowFallbackDriver: false });
}

watch(() => route.name, () => { void syncScenes(); });
const onMotionChange = (): void => {
  reducedMotion.value = reduceQuery.matches;
  void syncScenes();
};

onMounted(() => {
  mounted = true;
  syncScrollbar();
  scrollArea.value?.addEventListener('scroll', syncScrollbar, { passive: true });
  window.addEventListener('resize', syncScrollbar);
  reduceQuery.addEventListener('change', onMotionChange);
  void syncScenes();
});

onBeforeUnmount(() => {
  disposed = true;
  mounted = false;
  lifecycleVersion++;
  releaseScenes();
  scrollArea.value?.removeEventListener('scroll', syncScrollbar);
  window.removeEventListener('resize', syncScrollbar);
  reduceQuery.removeEventListener('change', onMotionChange);
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
        <EditorialHeader v-if="editorialRoute" />
        <SiteHeader
          v-else
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
      <div class="scrollbar__position" :style="positionStyle">
        <div class="scrollbar__thumb" :style="thumbStyle" />
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
  <FixedSignUpButton v-if="!editorialRoute" />
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
  position: absolute;
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
