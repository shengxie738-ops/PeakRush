<script setup lang="ts">
/**
 * HomeAudience.vue — home section 4, `home.audience` (docs/DOM_CONTRACT.md row 4),
 * reference `Landing3ArtWorld` (Cc-BjTZB.js). ui-pink, 1544px, 0 canvases.
 *
 * .section-3__loop-carousel holds the 10-name marquee twice (the bundle renders
 * `range(2)` groups of the same 10 members) and .section-3__loop-group carries the
 * 50s `loop-carousel-animation` from index.DRJU4ja6.css. Each card keeps the
 * reference DOM: .section-3__card-content overlay (name + role, each with the
 * icon-hover glyph) over the 160x160 person photo.
 * Heading copy is DOM_CONTRACT's `AUDIENCE SUPPORT` (text-transform:uppercase is
 * authored in .text-h2, so the measured string renders identically).
 */
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import BrushLink from '@/components/BrushLink.vue';
import { AUDIENCE, AUDIENCE_MEMBERS, IMG } from '@/content/home';
import { asset, iconAttrs, iconId } from '@/content/assetRegistry';

const root = ref<HTMLElement | null>(null);
const show = ref(false);

/**
 * The reference drives this heading through `transformTitle` (U-cHds8k.js `b`):
 *   u     = 1 - max(0, min(innerHeight/1.5, sectionTop)) / (innerHeight/1.5)
 *   scaleY = min(START + (1 - START) * u, 1)      START = 0.6 (the default)
 *   transform-origin: top
 * which is why hero-geometry.json records the visible h2 of section 4 as
 * `transform: matrix(1, 0, 0, 0.6, 0, 0)` — at scroll 0 the section is still one
 * viewport-height away, so the word sits at its authored squashed rest value and
 * only stretches to scaleY(1) as it reaches the top of the viewport. The lerp
 * (.175) is a frame-smoothing term and is deliberately not reproduced.
 */
const TITLE_START = 0.6;
const titleScale = ref(TITLE_START);
const titleStyle = computed<Record<string, string>>(() => ({
  transform: `scaleY(${titleScale.value})`,
  'transform-origin': 'top',
}));

const groups = Array.from({ length: AUDIENCE.loopGroups }, (_, index) => index);
const members = AUDIENCE_MEMBERS.map((member) => ({
  ...member,
  photo: asset(member.photo),
}));

function reveal(): void {
  const el = root.value;
  if (!el) return;
  show.value = el.getBoundingClientRect().top <= 0;
  const span = window.innerHeight / 1.5;
  const travel = Math.max(0, Math.min(span, el.getBoundingClientRect().top));
  const u = 1 - travel / (span || 1);
  titleScale.value = Math.min(TITLE_START + (1 - TITLE_START) * u, 1);
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

defineExpose({ sectionId: AUDIENCE.sectionId, root });
</script>

<template>
  <section ref="root" data-section-id="home.audience" class="ui-pink" data-page-header-theme="pink">
    <div class="section section--under-next">
      <div class="section__layer section__layer--sticky section__layer--full-height ui-background">
        <div class="section__layer section__layer--sticky section__layer--full-height pb-1 pt-promo-header">
          <div class="section-3">
            <div class="section-3__content row row--column:xs-down row--gx row--stretch px-1">
              <div class="col col-12 col--6:md">
                <div class="section-3__title">
                  <h2 class="text-h2 text-box-trim" :style="titleStyle">
                    {{ AUDIENCE.headingAccessible }}
                  </h2>
                  <img
                    class="section-3__title-decoration img-full"
                    :src="asset(IMG.usdCurrency) ?? ''"
                    alt=""
                  />
                </div>
              </div>
              <hr class="col--no-grow is-hidden:md-up mt-4 mb-1" />
              <div class="section-3__texts col-divider__right:md col col--grow col-12 col--6:md">
                <div class="section-3__sub-description">
                  <p class="text-smaller-xl text-right:md">{{ AUDIENCE.subDescription }}</p>
                </div>
                <p class="section-3__description mb-4 mb-0:md text-box-trim">
                  <BrushLink underline :show="show">{{ AUDIENCE.revealWord }}</BrushLink>
                  {{ AUDIENCE.descriptionTail }}
                </p>
              </div>
            </div>

            <hr class="is-hidden:sm-down my-1 mx-1" />

            <div class="section-3__loop-carousel mt-1 mt-0:md">
              <ul v-for="group in groups" :key="group" class="section-3__loop-group">
                <li v-for="(member, memberIndex) in members" :key="group + '-' + memberIndex" class="section-3__card">
                  <div class="section-3__card-content">
                    <div class="section-3__card-content-item section-3__card-content-name text-smaller">
                      <p class="section-3__card-content-item-text">{{ member.name }}</p>
                      <svg
                        v-bind="iconAttrs('hover')"
                        class="section-3__card-content-item-icon"
                        preserveAspectRatio="none"
                        aria-hidden="true"
                      >
                        <use :href="'#' + iconId('hover')" />
                      </svg>
                    </div>
                    <div class="section-3__card-content-item section-3__card-content-role text-smaller">
                      <p class="section-3__card-content-item-text">{{ member.role }}</p>
                      <svg
                        v-bind="iconAttrs('hover')"
                        class="section-3__card-content-item-icon"
                        preserveAspectRatio="none"
                        aria-hidden="true"
                      >
                        <use :href="'#' + iconId('hover')" />
                      </svg>
                    </div>
                  </div>
                  <img
                    class="img-full"
                    :src="member.photo ?? ''"
                    :width="160"
                    :height="160"
                    :alt="member.name"
                    :data-evidence="member.photo ? undefined : 'pending-T01-assets'"
                    loading="lazy"
                    draggable="false"
                  />
                </li>
              </ul>
            </div>

            <div class="fixed-sign-up-button-stub mt-3 is-hidden:md-up" />
          </div>
        </div>
      </div>
    </div>
  </section>
</template>
