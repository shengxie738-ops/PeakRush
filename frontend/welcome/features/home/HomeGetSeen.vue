<script setup lang="ts">
/**
 * HomeGetSeen.vue — home section 1, `home.get-seen` (docs/DOM_CONTRACT.md row 1),
 * reference component `Landing2GetSeen` + `Landing2GetSeenWebGl`
 * (evidence/reference/raw/_nuxt/Cc-BjTZB.js line 215+ and wH0WNvJv.js).
 *
 * Classes, grid columns and text order are the reference's; the heading is the
 * real <h2 class="text-h2"> with the two split words the bundle emits
 * ("CURATORS AND " / "ARTISTS"), the spiral <path>s of .section-2__title-icon-1/2
 * being lifted verbatim into src/content/displayHeadings.json.
 *
 * The "How FOLLOW. ART works?" panel is the WebGL mount: .section-2__media owns
 * the 1544px-row layout, the canvas is decoration, and video-preview.png (the
 * measured texture, webgl-scenes.json uniforms.imageTexture) is the static poster
 * until the first frame. The reference opens a Vimeo <iframe> on click — an
 * external embed, which DOM_CONTRACT marks "never clone", so the dialog keeps the
 * reference DOM and marks the media region pending instead of loading a third party.
 */
import { onBeforeUnmount, onMounted, ref } from 'vue';
import BrushLink from '@/components/BrushLink.vue';
import AccessibleDialog from '@/components/AccessibleDialog.vue';
import { GET_SEEN, IMG } from '@/content/home';
import { displaySvg } from '@/content/home';
import { asset } from '@/content/assetRegistry';
import type { WebGLMount } from '@/webgl/sceneRegistry';

const root = ref<HTMLElement | null>(null);
const canvasEl = ref<HTMLCanvasElement | null>(null);
const live = ref(false);
const show = ref(false);
const dialog = ref<InstanceType<typeof AccessibleDialog> | null>(null);

const spiral1 = displaySvg('get-seen-icon-1');
const spiral2 = displaySvg('get-seen-icon-2');
const poster = asset(IMG.videoPreview);

function reveal(): void {
  const el = root.value;
  if (!el) return;
  show.value = el.getBoundingClientRect().top <= 0;
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

function openVideo(): void {
  dialog.value?.show(root.value ?? undefined);
}

defineExpose({
  sectionId: GET_SEEN.sectionId,
  root,
  markLive(): void {
    live.value = true;
  },
  mount(): WebGLMount | null {
    if (!canvasEl.value) return null;
    return { kind: 'pointer-panel', canvas: canvasEl.value };
  },
});
</script>

<template>
  <section ref="root" data-section-id="home.get-seen" class="ui-green js-get-seen-section" data-page-header-theme="green">
    <div class="section section--under-next">
      <div class="section__layer section__layer--sticky section__layer--full-height ui-background">
        <div class="sticky sticky--sticky sticky--full-height px-1 pb-1 pt-promo-header">
          <div class="section-2 row row--gx row--gy row--stretch">
            <div class="col col-12 col--6:md col--last col--first:md mt-2.75 mt-0:md">
              <div class="section-2__media pr-1:md">
                <div class="section-2__media-wrapper" @click="openVideo">
                  <div class="section-2__video-preview-wrapper">
                    <div
                      class="landing-2-get-seen-webgl"
                      :data-webgl="live ? 'live' : 'pending'"
                    >
                      <span v-if="!live && poster" class="webgl-fallback">
                        <img :src="poster" alt="" width="3375" height="4219" />
                      </span>
                      <canvas ref="canvasEl" aria-hidden="true" />
                    </div>
                    <div class="section-2__video-preview-wrapper-inner">
                      <BrushLink
                        variant="secondary square block accent"
                        class="section-2__video-preview-play-btn"
                        :aria-label="GET_SEEN.playLabel"
                        as-button
                        @click="openVideo"
                      >
                        <img
                          class="section-2__video-preview-play-icon img-full"
                          :src="asset(IMG.mediaPlay) ?? ''"
                          alt=""
                        />
                      </BrushLink>
                      <p class="section-2__video-preview-title text-bit-small text-box-trim">
                        {{ GET_SEEN.mediaTitle[0] }}<br />
                        {{ GET_SEEN.mediaTitle[1] }}<br />
                        {{ GET_SEEN.mediaTitle[2] }}
                      </p>
                    </div>
                  </div>
                  <img class="section-2__media-decoration img-full" :src="asset(IMG.helix) ?? ''" alt="" />
                </div>
              </div>
              <div class="fixed-sign-up-button-stub mt-3 is-hidden:md-up" />
            </div>

            <div class="section-2__content col-divider__right:md col col-12 col--6:md">
              <div class="section-2__content-top">
                <div class="section-2__title">
                  <h2 class="text-h2 text-box-trim">
                    <span>{{ GET_SEEN.headingWords[0] }}</span>
                    <span class="section-2__title-seen-word">
                      <span>{{ GET_SEEN.headingWords[1] }}</span>
                      <span
                        v-if="spiral1"
                        class="section-2__title-icon-wrap"
                        data-evidence="reference-svg-glyphs"
                        v-html="spiral1.html"
                      />
                      <span
                        v-if="spiral2"
                        class="section-2__title-icon-wrap"
                        data-evidence="reference-svg-glyphs"
                        v-html="spiral2.html"
                      />
                    </span>
                  </h2>
                </div>
              </div>
              <hr class="mt-4 mb-1 my-1:md" />
              <div class="section-2__content-bottom">
                <p class="section-2__description text-box-trim">
                  {{ GET_SEEN.bullets[0] }}<br />
                  {{ GET_SEEN.bullets[1] }}<br />
                  {{ GET_SEEN.bullets[2] }}<br /><br />
                  <BrushLink underline :show="show">{{ GET_SEEN.revealWord }}</BrushLink>
                  {{ GET_SEEN.descriptionTail }}
                </p>
              </div>
            </div>
          </div>

          <AccessibleDialog
            ref="dialog"
            id="get-seen-video"
            theme="dark"
            variant="video"
            :title="GET_SEEN.modalTitle"
          >
            <template #header>
              <div class="gallery-masonry-header px-1 row row--gx row--middle">
                <div class="col col--12 text-center mt-1 is-hidden:sm-down">
                  <p class="text-box-trim text-card-base">{{ GET_SEEN.modalTitle }}</p>
                </div>
              </div>
              <hr class="mt-3.5 is-hidden:md-up hr-thin" />
            </template>
            <div class="section-2__video-player-wrapper">
              <div class="section-2__video-player peakrush-guide px-1">
                <ol class="peakrush-guide__steps">
                  <li><span>01</span><strong>登录账号</strong><p>登录或注册 PeakRush，开启抢购之旅。</p></li>
                  <li><span>02</span><strong>选择场次</strong><p>查看开抢时间、商品价格和限购规则。</p></li>
                  <li><span>03</span><strong>准点开抢</strong><p>提交抢购后等待处理结果，避免重复创建请求。</p></li>
                  <li><span>04</span><strong>查看订单</strong><p>抢购成功后，在订单有效时间内完成模拟支付。</p></li>
                </ol>
                <BrushLink href="/app/" variant="primary accent" title="进入商城" icon="step-next" />
              </div>
            </div>
          </AccessibleDialog>
        </div>
      </div>
    </div>
  </section>
</template>

<style>
/* CLONE-LOCAL: the two spiral icons are absolutely positioned inside
   .section-2__title-seen-word by .section-2__title-icon-1/-2 (index.DRJU4ja6.css);
   the v-html wrapper must therefore be contents-only. */
.section-2__title-icon-wrap {
  display: contents;
}
.peakrush-guide { display: flex; flex-direction: column; justify-content: center; gap: 2rem; padding: 4rem; }
.peakrush-guide__steps { list-style: none; padding: 0; display: grid; grid-template-columns: 1fr 1fr; gap: 3rem; }
.peakrush-guide__steps span { display: block; color: #f4793a; font-size: 3rem; }
.peakrush-guide__steps strong { display: block; margin: 1rem 0; }
.peakrush-guide__steps p { font-size: 1.5rem; line-height: 1.7; color: #c5c5c5; }
@media (max-width: 600px) { .peakrush-guide__steps { grid-template-columns: 1fr; } }
</style>
