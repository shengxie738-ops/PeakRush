<script setup lang="ts">
/**
 * HomeTestimonials.vue — home section 5, `home.testimonials` (docs/DOM_CONTRACT.md
 * row 5), reference `Landing9Testimonials` + `Landing9TestimonialsWebGl`
 * (Cc-BjTZB.js, BsSV4kAi.js). ui-blue, 1544px, 1 canvas.
 *
 * Prev/Next and the WebGL drag controller share an index through the host's event.
 * A selected product poster remains usable when WebGL or motion is unavailable.
 */
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import BrushLink from '@/components/BrushLink.vue';
import DisplayHeading from '@/components/DisplayHeading.vue';
import { TESTIMONIALS, IMG } from '@/content/home';
import { asset } from '@/content/assetRegistry';
import { canvasCountFor } from '@/webgl/sceneRegistry';
import type { WebGLMount } from '@/webgl/sceneRegistry';

const root = ref<HTMLElement | null>(null);
const carouselHost = ref<HTMLElement | null>(null);
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

const syncIndex = (event: Event): void => {
  const selected = (event as CustomEvent<{ index: number }>).detail.index;
  if (Number.isInteger(selected) && selected >= 0 && selected < count) index.value = selected;
};
onMounted(() => carouselHost.value?.addEventListener('peakrush:carousel-index', syncIndex));
onBeforeUnmount(() => carouselHost.value?.removeEventListener('peakrush:carousel-index', syncIndex));

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
              ref="carouselHost"
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
              <span class="webgl-fallback">
                <img :src="IMG.review(index + 1)" alt="精选好物" />
              </span>
              <div class="landing-9-testimonials-webgl__navigation">
                <BrushLink
                  variant="block link accent"
                  icon="step-back"
                  icon-position="left"
                  :title="TESTIMONIALS.prev"
                  text-size="smaller"
                  :disabled="prevDisabled"
                  as-button
                  data-carousel-step="prev"
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
                  data-carousel-step="next"
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
