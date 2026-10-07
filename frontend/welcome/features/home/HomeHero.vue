<script setup lang="ts">
/**
 * HomeHero.vue — home section 0, `home.hero` (docs/DOM_CONTRACT.md row 0),
 * reference component `Landing1Intro` + `Landing1IntroWebGl`
 * (evidence/reference/raw/_nuxt/Cc-BjTZB.js, CDL_IiwC.js).
 *
 *   <section>                                  (no class — it inherits orange)
 *     <div class="section section--under-next">
 *       <div class="section__layer section__layer--sticky section__layer--full-height
 *                  ui-orange ui-background intro intro--show" data-page-header-theme="orange">
 *         <div class="landing-1-intro-webgl">
 *           <div><div class="px-1 pt-promo-header"> <h1 …>FOLLOW.ART</h1> … </div></div>
 *           <div class="landing-1-intro-webgl__canvas-wrapper" data-preload-event>2 canvases</div>
 *         </div>
 *         <div class="intro__footer …">One Card. / Share it. Be noticed. / Be supported</div>
 *
 * The layer owns the 1544px layout height; the canvases are decoration and the
 * static Card-1 poster is visible until the scene reports a first frame.
 */
import { computed, ref } from 'vue';
import DisplayHeading from '@/components/DisplayHeading.vue';
import { HERO, IMG } from '@/content/home';
import { asset, iconAttrs, iconId } from '@/content/assetRegistry';
import { canvasCountFor } from '@/webgl/sceneRegistry';
import type { WebGLMount } from '@/webgl/sceneRegistry';

const loading = ref(false);
const root = ref<HTMLElement | null>(null);
const canvasWrapper = ref<HTMLElement | null>(null);
const canvasA = ref<HTMLCanvasElement | null>(null);
const canvasB = ref<HTMLCanvasElement | null>(null);
const live = ref(false);

const layerClass = computed(() => [
  'section__layer',
  'section__layer--sticky',
  'section__layer--full-height',
  'ui-orange',
  'ui-background',
  'intro',
  !loading.value ? 'intro--show' : '',
]);

const poster = computed(() => asset(IMG.heroCard(1)));
const canvasCount = canvasCountFor(HERO.sectionId);

/* the reference adds .intro--show once its preload finishes and hides the
   LoadingScreen at the same moment; this clone never blocks on the network, so
   the revealed state is the initial state and every word is on screen at once. */
const LOADING_SCREEN_DECOR = [
  'star',
  'vortex',
  'emoji-smile',
  'flower',
  'loop-arrows',
] as const;

defineExpose({
  sectionId: HERO.sectionId,
  root,
  canvasWrapper,
  markLive(): void {
    live.value = true;
  },
  mount(): WebGLMount | null {
    if (!canvasA.value || !canvasB.value) return null;
    return { kind: 'card-ring', canvases: [canvasA.value, canvasB.value] };
  },
  canvasCount,
});
</script>

<template>
  <section ref="root" data-section-id="home.hero" :data-page-header-theme="undefined">
    <div class="section section--under-next">
      <div
        :class="layerClass"
        data-page-header-theme="orange"
      >
        <div class="landing-1-intro-webgl">
          <div>
            <div class="px-1 pt-promo-header">
              <DisplayHeading
                is="h1"
                :title="HERO.accessibleTitle"
                svg-key="follow-art"
                visual-class="intro__title is-hidden:sm-down svg-fix"
              />
              <div class="intro__title-decoration">
                <img class="img-full" :src="asset(IMG.line) ?? ''" alt="" />
              </div>
            </div>
          </div>

          <div
            ref="canvasWrapper"
            class="landing-1-intro-webgl__canvas-wrapper"
            :data-webgl="live ? 'live' : 'pending'"
            data-preload-event="landing-1-intro"
          >
            <!-- CLONE-LOCAL static poster: Card-1.png, one of the 9 measured hero
                 textures (webgl-scenes.json textures Card-1..9, 700x1080 native).
                 Removed from the box as soon as the scene has rendered. -->
            <span v-if="!live && poster" class="webgl-fallback">
              <img :src="poster" alt="" width="700" height="1080" />
            </span>
            <canvas ref="canvasA" aria-hidden="true" />
            <canvas v-if="canvasCount > 1" ref="canvasB" aria-hidden="true" />
            <span v-if="!poster" class="sr-only" data-evidence="pending-T01-assets">
              FOLLOW.ART card ring
            </span>
          </div>
        </div>

        <div class="intro__footer px-1 py-1 mt-1 mt-3:md">
          <div class="row row--gx row--bottom mt-auto">
            <div class="col col--12 col--11:md">
              <p class="text-box-trim text-right text-left:md">
                {{ HERO.footerLines[0] }}
                <br />
                {{ HERO.footerLines[1] }}
                <br class="is-hidden:md-up" />
                <span class="intro__text-icon-wrapper">
                  <svg v-bind="iconAttrs('promo-next')" class="intro__text-icon is-hidden:md-up" aria-hidden="true">
                    <use :href="'#' + iconId('promo-next')" />
                  </svg>
                  {{ HERO.footerLines[2] }}
                  <svg v-bind="iconAttrs('promo-next')" class="intro__text-icon is-hidden:sm-down" aria-hidden="true">
                    <use :href="'#' + iconId('promo-next')" />
                  </svg>
                </span>
              </p>
            </div>
            <div class="col col--12 col--1:md mt-2 mt-0:md">
              <div class="fixed-sign-up-button-stub" />
            </div>
          </div>
        </div>
      </div>

      <!-- LoadingScreen (CN9o5T7v.js) — present only while the reference waits for
           its asset preload; this clone never blocks on the network, so the block
           is rendered with v-if="loading" and loading starts false. -->
      <div v-if="loading" class="ui-orange loading-screen loading-screen--background">
        <img
          v-for="(decoration, index) in LOADING_SCREEN_DECOR"
          :key="decoration"
          class="loading-screen__decoration loading-screen__decoration-img img-full"
          :class="`loading-screen__decoration-${index + 1}`"
          fetchpriority="high"
          :src="asset('/images/landing/common/' + decoration + '.svg') ?? ''"
          alt=""
        />
      </div>
    </div>
  </section>
</template>
