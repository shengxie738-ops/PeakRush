<script setup lang="ts">
/**
 * HomeJoinUs.vue — home section 7, `home.join` (docs/DOM_CONTRACT.md row 7), the
 * reference `Landing10JoinUs` + `ImageTrail` (evidence/reference/raw/_nuxt/CCJzzdh0.js).
 * `ui-orange wrapper-section-10`, measured height 808px, 0 canvases.
 *
 * The measured footer text order lives in <SiteFooter>, rendered here inside the
 * .section-10 flow exactly where the reference puts it (after <hr class="my-1">).
 * The 18-photo .image-trail keeps the reference DOM; photos 4-18 carry the
 * reference's own `is-hidden` class because the pointer trail that reveals them is
 * motion the ImageTrail component drives with a pointer tracker — dropped under
 * prefers-reduced-motion, and out of scope for a static DOM clone.
 */
import { onBeforeUnmount, onMounted, ref } from 'vue';
import BrushLink from '@/components/BrushLink.vue';
import DisplayHeading from '@/components/DisplayHeading.vue';
import SiteFooter from '@/components/SiteFooter.vue';
import { IMAGE_TRAIL_ORDER, JOIN, IMG } from '@/content/home';
import { asset } from '@/content/assetRegistry';

const root = ref<HTMLElement | null>(null);
const show = ref(false);

const trail = IMAGE_TRAIL_ORDER.map((number, index) => ({
  number,
  index,
  src: asset(IMG.trail(number)),
}));

function reveal(): void {
  const el = root.value;
  if (el) show.value = el.getBoundingClientRect().top <= 1;
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

defineExpose({ sectionId: JOIN.sectionId, root });
</script>

<template>
  <section ref="root" data-section-id="home.join" class="ui-orange wrapper-section-10" data-page-header-theme="orange">
    <div class="section">
      <div class="section__layer section__layer--sticky section__layer--full-height ui-background">
        <div class="sticky sticky--sticky sticky--full-height px-1 pb-1 pt-promo-header">
          <div class="section-10">
            <div class="section-10__content row row--gx row--stretch">
              <div class="col col-12 col--6:md pr-1:md section-10__content-col">
                <DisplayHeading
                  is="h2"
                  :title="JOIN.accessibleTitle"
                  svg-key="join-us"
                  visual-class="section-10__title--desktop img-full is-hidden:sm-down svg-fix"
                >
                  <img
                    class="section-10__title-decoration img-full"
                    :src="asset(IMG.usWord) ?? ''"
                    alt=""
                  />
                </DisplayHeading>

                <div class="image-trail">
                  <div
                    v-for="photo in trail"
                    :key="photo.number"
                    :class="[
                      'image-trail__photo',
                      photo.index < 3 ? `image-trail__photo--${photo.index + 1}` : 'is-hidden',
                      photo.index < 3 ? `image-trail__photo--active-${photo.index + 1}` : '',
                    ]"
                  >
                    <img
                      class="img-full"
                      :src="photo.src ?? ''"
                      width="160"
                      height="160"
                      alt=""
                      loading="lazy"
                      draggable="false"
                      :data-evidence="photo.src ? undefined : 'pending-T01-assets'"
                    />
                  </div>
                </div>
              </div>

              <div
                class="section-10__content-side col col-12 col--6:md col-divider__right:md mt-6.5 mt-0:md"
              >
                <p class="section-10__description text-box-trim">
                  <BrushLink underline :show="show">{{ JOIN.revealWord }}</BrushLink>
                  {{ JOIN.descriptionTail }}
                </p>
                <div class="section-10__btn-grid">
                  <div class="section-10__btn-wrapper mt-5.5 mt-7:md">
                    <div class="section-10__btn-icon">
                      <img class="icon-shake-reverse img-full" :src="asset(IMG.promoArrow) ?? ''" alt="" />
                    </div>
                    <div>
                      <BrushLink
                        variant="primary full accent"
                        :aria-label="JOIN.ariaLabel"
                        size="large"
                        icon="step-next"
                        to="/signup"
                        >
Join<span class="sr-only">{{ JOIN.ariaLabel }}</span>
</BrushLink
                      >
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <hr class="my-1" />

            <SiteFooter />
          </div>
        </div>
      </div>
    </div>
  </section>
</template>
