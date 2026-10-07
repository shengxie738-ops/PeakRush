<script setup lang="ts">
/**
 * HomeConnectory.vue — home section 6, `home.connectory` (docs/DOM_CONTRACT.md row 6),
 * reference `Landing7Connectory` + `Landing7ConnectoryWebGl` (Cc-BjTZB.js, CrHBTwDc.js).
 * ui-green, 2316px (content overflows the 200svh slots), 1 canvas.
 *
 * sceneRegistry marks landing-7 built:false (webgl-scenes.json: "未取到场景
 * （渲染门控/离屏）") and its single texture /images/landing/7.connectory/image.png
 * was never downloaded, so the measured .landing-7-connectory-webgl box keeps the
 * measured canvas count and a data-evidence="pending-T00-webgl-scene" marker; every
 * word of copy around it is the measured text.
 */
import { onBeforeUnmount, onMounted, ref } from 'vue';
import BrushLink from '@/components/BrushLink.vue';
import DisplayHeading from '@/components/DisplayHeading.vue';
import { CONNECTORY, IMG } from '@/content/home';
import { asset } from '@/content/assetRegistry';
import { canvasCountFor } from '@/webgl/sceneRegistry';
import type { WebGLMount } from '@/webgl/sceneRegistry';

const root = ref<HTMLElement | null>(null);
const show = ref(false);

const canvasCount = canvasCountFor(CONNECTORY.sectionId);

function reveal(): void {
  const el = root.value;
  if (el) show.value = el.getBoundingClientRect().top <= 0;
}

let frame = 0;
function schedule(): void {
  if (frame) return;
  frame = window.requestAnimationFrame(() => {
    frame = 0;
    reveal();
  });
}

onMounted(() => {
  reveal();
  document.querySelector<HTMLElement>('.scrollable__area')?.addEventListener('scroll', schedule, { passive: true });
  window.addEventListener('resize', schedule);
});

onBeforeUnmount(() => {
  if (frame) window.cancelAnimationFrame(frame);
  document.querySelector<HTMLElement>('.scrollable__area')?.removeEventListener('scroll', schedule);
  window.removeEventListener('resize', schedule);
});

defineExpose({
  sectionId: CONNECTORY.sectionId,
  root,
  markLive(): void {
    /* no captured scene: the placeholder stays by design */
  },
  mount(): WebGLMount | null {
    return null;
  },
});
</script>

<template>
  <section ref="root" data-section-id="home.connectory" class="ui-green" data-page-header-theme="green">
    <div class="section section--under-next">
      <div class="section__layer section__layer--sticky ui-background">
        <div class="section-7 px-1 pb-1 pt-promo-header">
          <div class="section-7__header col col-12">
            <p class="section-7__subtitle mb-3.5 mb-4:md text-box-trim">{{ CONNECTORY.subtitle }}</p>
            <DisplayHeading
              is="h2"
              :title="CONNECTORY.accessibleTitle"
              svg-key="connectory"
              visual-class="section-7__title--desktop img-full is-hidden:sm-down svg-fix"
            >
              <img class="section-7__title-decoration img-full" :src="asset(IMG.the) ?? ''" alt="" />
              <div
                class="landing-7-connectory-webgl"
                data-evidence="pending-T00-webgl-scene"
              >
                <canvas v-for="slot in canvasCount" :key="slot" aria-hidden="true" />
              </div>
            </DisplayHeading>
          </div>

          <hr class="col col-12 mt-1.75 mb-1 mt-1:md" />

          <div class="section-7__content row row--gx col col-12">
            <div class="section-7__content-side col col-12 col--6:md pr-1:md">
              <p class="section-7__description-1 mb-1.75 mb-0:md text-box-trim">
                {{ CONNECTORY.description1Lead }}
                <BrushLink underline :show="show">{{ CONNECTORY.revealWord }}</BrushLink>
                {{ CONNECTORY.description1Tail }}
              </p>
              <p class="text-box-trim is-hidden:md-up">
                {{ CONNECTORY.description2[0] }} {{ CONNECTORY.description2[1] }}
              </p>
              <div class="section-7__btn-wrapper is-hidden:md-up mt-7">
                <div class="section-7__btn-icon">
                  <img class="icon-shake-reverse img-full" :src="asset(IMG.promoArrow) ?? ''" alt="" />
                </div>
                <div class="fixed-sign-up-button-stub" />
              </div>
            </div>

            <div class="section-7__content-side col col-12 col--6:md col-divider__right is-hidden:sm-down">
              <p class="section-7__description-2 text-box-trim">
                {{ CONNECTORY.description2[0] }}
                <br />
                <br />
                {{ CONNECTORY.description2[1] }}
              </p>
              <div class="section-7__btn-grid">
                <div class="section-7__btn-wrapper mt-12">
                  <div class="section-7__btn-icon">
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
