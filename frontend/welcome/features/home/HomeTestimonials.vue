<script setup lang="ts">
/**
 * HomeTestimonials.vue — home section 5, `home.testimonials` (docs/DOM_CONTRACT.md
 * row 5), reference `Landing9Testimonials` + `Landing9TestimonialsWebGl`
 * (Cc-BjTZB.js, BsSV4kAi.js). ui-blue, 1544px, 1 canvas.
 *
 * sceneRegistry marks this section built:false — webgl-scenes.json records
 * "landing-9-testimonials … 未取到场景（渲染门控/离屏）", and its 8 review textures
 * (/images/landing/9.testimonials/Review-1..8.png) were never downloaded
 * (see src/content/assets.manifest.json). The DOM therefore keeps the measured
 * .landing-9-testimonials-webgl box, the measured canvas count and the measured
 * Prev / Next navigation, and the card region carries
 * data-evidence="pending-T00-webgl-scene" instead of invented artwork. Prev / Next
 * still move the measured index (0 … count-1) with the reference's edge disabling.
 */
import { computed, ref } from 'vue';
import BrushLink from '@/components/BrushLink.vue';
import DisplayHeading from '@/components/DisplayHeading.vue';
import { TESTIMONIALS, IMG } from '@/content/home';
import { asset } from '@/content/assetRegistry';
import { canvasCountFor } from '@/webgl/sceneRegistry';
import type { WebGLMount } from '@/webgl/sceneRegistry';

const root = ref<HTMLElement | null>(null);
const index = ref(0);

const count = TESTIMONIALS.cardCount;
const canvasCount = canvasCountFor(TESTIMONIALS.sectionId);

const prevDisabled = computed(() => index.value === 0);
const nextDisabled = computed(() => index.value === count - 1);

function previous(): void {
  if (!prevDisabled.value) index.value -= 1;
}

function next(): void {
  if (!nextDisabled.value) index.value += 1;
}

defineExpose({
  sectionId: TESTIMONIALS.sectionId,
  root,
  markLive(): void {
    /* no captured scene: the poster/placeholder stays visible by design */
  },
  mount(): WebGLMount | null {
    return null;
  },
});
</script>

<template>
  <section ref="root" data-section-id="home.testimonials" class="ui-blue" data-page-header-theme="blue">
    <div class="section section--under-next">
      <div class="section__layer section__layer--sticky ui-background">
        <div class="section-9 pb-1 pt-promo-header">
          <p class="section-9__description px-1 text-box-trim col--last:md mb-3.5 mb-0:md mt-7:md">
            {{ TESTIMONIALS.description }}
          </p>

          <div class="section-9__header px-1 col col-12">
            <DisplayHeading
              is="h2"
              :title="TESTIMONIALS.accessibleTitle"
              svg-key="testimonials"
              visual-class="section-9__title--desktop is-hidden:sm-down svg-fix"
            >
              <img
                class="section-9__title-decoration icon-shake img-full"
                :src="asset(IMG.speechBalloon) ?? ''"
                alt=""
              />
            </DisplayHeading>
          </div>

          <div class="section-9__cards">
            <div
              class="landing-9-testimonials-webgl"
              data-evidence="pending-T00-webgl-scene"
              :data-webgl-index="index"
            >
              <canvas
                v-for="slot in canvasCount"
                :key="slot"
                ref="canvasEl"
                aria-hidden="true"
              />
              <div class="landing-9-testimonials-webgl__navigation">
                <BrushLink
                  variant="block link accent"
                  icon="step-back"
                  icon-position="left"
                  :title="TESTIMONIALS.prev"
                  text-size="smaller"
                  :disabled="prevDisabled"
                  as-button
                  @click="previous"
                />
                <BrushLink
                  variant="block link accent"
                  icon="step-next"
                  icon-position="right"
                  :title="TESTIMONIALS.next"
                  text-size="smaller"
                  :disabled="nextDisabled"
                  as-button
                  @click="next"
                />
              </div>
            </div>
          </div>

          <div class="fixed-sign-up-button-stub mt-3 is-hidden:md-up" />
        </div>
      </div>
    </div>
  </section>
</template>
