<script setup lang="ts">
/**
 * HomeCard.vue — home section 2, `home.card` (docs/DOM_CONTRACT.md row 2), the
 * reference `Landing5Nexus` + `Landing5NexusWebGl` (Cc-BjTZB.js line ~484,
 * DrDDqcjH.js). Reference class `ui-pink`, measured height 2123px, one canvas.
 *
 * The giant word CARD is the reference inline glyph SVG
 * (src/content/displayHeadings.json → "card"). The layout owner is
 * .section-5__header / .landing-5-nexus-webgl__content (aspect-ratio 1.25/1 at md-up
 * from Landing5NexusWebGl.DUcfhe4o.css = the measured canvasCss 1032x826); the
 * canvas is decoration and card-1.png / card-2.png (webgl-scenes.json mesh
 * textures) are the static poster until the first frame.
 */
import { ref } from 'vue';
import DisplayHeading from '@/components/DisplayHeading.vue';
import { CARD, IMG } from '@/content/home';
import { asset } from '@/content/assetRegistry';
import type { WebGLMount } from '@/webgl/sceneRegistry';

const root = ref<HTMLElement | null>(null);
const content = ref<HTMLElement | null>(null);
const canvasEl = ref<HTMLCanvasElement | null>(null);
const live = ref(false);

const poster = asset(IMG.nexusCard(1));
const posterAlt = asset(IMG.nexusCard(2));

defineExpose({
  sectionId: CARD.sectionId,
  root,
  markLive(): void {
    live.value = true;
  },
  mount(): WebGLMount | null {
    if (!canvasEl.value) return null;
    return { kind: 'curved-panel', canvas: canvasEl.value };
  },
});
</script>

<template>
  <section ref="root" data-section-id="home.card" class="ui-pink" data-page-header-theme="pink">
    <div class="section section--under-next">
      <div class="section__layer section__layer--sticky ui-background">
        <div class="section-5 px-1 pb-1 pt-promo-header">
          <div class="section-5__header col col-12">
            <DisplayHeading
              is="h2"
              :title="CARD.accessibleTitle"
              svg-key="card"
              visual-class="section-5__title--desktop is-hidden:sm-down svg-fix"
            >
              <img
                class="section-5__title-decoration is-hidden:md-up img-full"
                :src="asset(IMG.the) ?? ''"
                alt="Card for artists — share your portfolio, bio, exhibitions, and awards with one professional."
              />
            </DisplayHeading>

            <div class="landing-5-nexus-webgl section-5__header-webgl" :data-webgl="live ? 'live' : 'pending'">
              <div ref="content" class="landing-5-nexus-webgl__content">
                <span v-if="!live && poster" class="webgl-fallback">
                  <img :src="poster" alt="" width="780" height="1560" />
                  <img v-if="posterAlt" class="webgl-fallback__second" :src="posterAlt" alt="" width="780" height="1560" />
                </span>
                <canvas ref="canvasEl" aria-hidden="true" />
              </div>
            </div>
          </div>

          <hr class="col col-12 my-1" />

          <div class="section-5__content row row--gx col col-12">
            <div class="section-5__content-side col col-12 col--6:md pr-1:md">
              <p class="section-5__description-1 mb-1.75 mb-0:md text-box-trim">{{ CARD.description1 }}</p>
              <p class="text-box-trim is-hidden:md-up">{{ CARD.description2 }}</p>
              <div class="section-5__btn-wrapper is-hidden:md-up mt-7">
                <div class="section-5__btn-icon">
                  <img class="icon-shake-reverse img-full" :src="asset(IMG.promoArrow) ?? ''" alt="" />
                </div>
                <div class="fixed-sign-up-button-stub" />
              </div>
            </div>
            <div class="section-5__content-side col col-12 col--6:md col-divider__right is-hidden:sm-down">
              <p class="section-5__description-2 text-box-trim">{{ CARD.description2 }}</p>
              <div class="section-5__btn-grid">
                <div class="section-5__btn-wrapper mt-7">
                  <div class="section-5__btn-icon">
                    <img class="icon-shake-reverse img-full" :src="asset(IMG.promoArrow) ?? ''" alt="" />
                  </div>
                  <div class="fixed-sign-up-button-stub" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<style>
/* CLONE-LOCAL: the nexus scene is two measured meshes (webgl-scenes.json), so the
   poster shows both captured card textures side by side inside the same box. */
.webgl-fallback__second {
  left: auto;
  opacity: 0.85;
  position: absolute;
  right: 0;
  top: 0;
  width: 50%;
}
</style>
