<script setup lang="ts">
/**
 * HomeCentralize.vue — home section 3, `home.centralize` (docs/DOM_CONTRACT.md
 * row 3), reference `Landing4FollowArt` (Cc-BjTZB.js). ui-green, 1544px, 0 canvases
 * (no WebGL in DOM_CONTRACT for this row), so there is no mount or poster here.
 *
 * .section-4__title is the giant literal type pair CENTRA / LIZE lifted from
 * index.DRJU4ja6.css (228/1460vw at md-up) with the star decoration between the two
 * words; the four .section-4__card flip cards are an <ol> whose front/back copy is
 * the measured text (front = number + label, back = number + explanation).
 */
import { onBeforeUnmount, onMounted, ref } from 'vue';
import BrushLink from '@/components/BrushLink.vue';
import { CENTRALIZE, IMG } from '@/content/home';
import { asset } from '@/content/assetRegistry';

const root = ref<HTMLElement | null>(null);
const show = ref(false);

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

defineExpose({ sectionId: CENTRALIZE.sectionId, root });
</script>

<template>
  <section ref="root" data-section-id="home.centralize" class="ui-green" data-page-header-theme="green">
    <div class="section section--under-next">
      <div class="section__layer section__layer--sticky section__layer--full-height ui-background">
        <div class="sticky sticky--sticky sticky--full-height px-1 pb-1 pt-promo-header">
          <div class="section-4 row row--gx row--stretch">
            <div class="section-4__content col col-12 col--6:md pr-1:md">
              <h2 class="section-4__title text-h2 text-box-trim">
                <span class="section-4__title-word--inline-block">{{ CENTRALIZE.headingWords[0] }}</span>
                <span class="section-4__title-word">
                  <span class="section-4__title-word--inline-block">{{ CENTRALIZE.headingWords[1] }}</span>
                  <img
                    class="section-4__title-word-decoration icon-shake"
                    :src="asset(IMG.star) ?? ''"
                    width="52"
                    height="55"
                    alt=""
                    aria-hidden="true"
                  />
                </span>
              </h2>
              <hr class="mt-4 mb-1 my-1:md is-hidden:md-up" />
              <div class="section-4__content-texts mb-4 mb-0:md mt-9.5:md">
                <p class="section-4__description text-box-trim">
                  <BrushLink underline :show="show">{{ CENTRALIZE.revealWord }}</BrushLink>
                  {{ CENTRALIZE.descriptionTail }}
                  <br />
                  <br />
                  {{ CENTRALIZE.subhead }}
                </p>
              </div>
            </div>

            <div class="section-4__cards-wrapper col col-12 col--6:md col-divider__right:md">
              <div class="section-4__cards-wrapper-decoration">
                <img :src="asset(IMG.cross) ?? ''" width="398" height="440" alt="" />
              </div>
              <ol class="section-4__cards ui-dark">
                <li v-for="card in CENTRALIZE.cards" :key="card.index" class="section-4__card">
                  <div class="section-4__card-inner">
                    <div class="section-4__card-front">
                      <span class="text-smaller text-box-trim">{{ card.index }}</span>
                      <p class="text-small text-box-trim">
                        {{ card.front[0] }}<br />
                        {{ card.front[1] }}
                      </p>
                    </div>
                    <div class="section-4__card-back">
                      <span class="text-smaller text-box-trim">{{ card.index }}</span>
                      <p class="text-small text-box-trim">{{ card.back }}</p>
                    </div>
                  </div>
                </li>
              </ol>
              <div class="fixed-sign-up-button-stub mt-3 is-hidden:md-up" />
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>
