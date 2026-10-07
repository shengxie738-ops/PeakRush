<script setup lang="ts">
/**
 * PricingGiftCardSection — the SECOND `.section__layer--sticky` of `/pricing`.
 *
 * Reference structure (viewport 1376x772 @ dpr 1.5, CSS px, y = absolute document
 * position), measured 2026-10-01:
 *
 *   layer 1  subscription  [0,    0, 1376, 2214]  ground rgb(197,147,157) #c5939d
 *   layer 2  gift card     [0, 2214, 1376, 1883]  ground rgb(244,121,58)  #f4793a
 *     .section__layer.section__layer--sticky.section__layer--full-height  [0,2214,1376,1883]
 *       .sticky.sticky--sticky.sticky--full-height                        [0,2214,1376,1883]
 *         .gift-card-section.row.row--gx.row--stretch                     [0,2290,1376,1807]
 *           h2.sr-only "GIFT CARD"                                        [19,2289,1,1]
 *           .gift-card-section__content.col.col-12.col--6:md              [19,2290,659,676]  flex
 *           .gift-card-section__form-wrapper.col.col-12.col--6:md         [698,2290,659,1807] #fff
 *
 * Layer 2 really is orange and layer 1 really is pink — the two are NOT the same
 * ground, which is why layer 1's `.subscription-and-pricing-section-layer` carries
 * no background rule of its own while this one needs the `ui-orange` theme token.
 *
 * The 76px between the layer top (2214) and the row top (2290) is
 * `var(--spacing-promo-header)` (80 x --scale-px = 76.44px at 1376), and the 19px
 * inset of both columns is `var(--spacing)` (20 x --scale-px = 19.104px). The row's
 * own box is still 1376 wide because that inset is padding, so the horizontal
 * gutter is declared on `.gift-card-section` here rather than by adding a `px-1`
 * the measured class list does not carry.
 *
 * The word-mark chain is the one that broke the sibling route `/gift-card`: the
 * 631px SVG width is *produced by* the 6-column grid plus `pr-1` on
 * `.gift-card-section__title`. Putting `.title` straight into a full-bleed parent
 * renders the mark 1376px wide, so the grid column has to be the ancestor.
 *
 * Every string comes from src/content/subpages/giftCard.ts (GIFT_CARD) and every
 * image offset from GIFT_CARD_PRICING_GEOMETRY, which is already expressed in
 * --scale-px units relative to the block's own column — this component therefore
 * carries no measured number of its own beyond the ones quoted above.
 *
 * NOT reproduced, and marked `data-evidence="pending-T00-subpage"` instead of
 * invented: the purchase form's field-level internals (`.buying-gift-card-form`)
 * and the Trustpilot region, which on the reference is a cross-origin iframe and
 * is never requested here. No network call is made, no new prose is written, and
 * no unobserved state (hover / focus / invalid / post-submit) is styled.
 */
import { computed } from 'vue';
import { displaySvg } from '@/content/home';
import { GIFT_CARD, GIFT_CARD_PRICING_GEOMETRY } from '@/content/subpages/giftCard';

/** The captured 8-path GIFT CARD glyph set (viewBox 0 0 667 383). */
const wordmark = computed(() => displaySvg('gift-card-title')?.html ?? '');

/** The `/pricing` copy of the press strip measures six logos in two rows. */
const partners = computed(() => GIFT_CARD.partners.slice(0, GIFT_CARD.pricingPartnerCount));

/** --scale-px offsets, straight out of GIFT_CARD_PRICING_GEOMETRY. */
const scalePx = (n: number) => `calc(var(--scale-px) * ${n})`;
const geo = GIFT_CARD_PRICING_GEOMETRY;
const titleDecorationStyle = {
  left: scalePx(geo.titleDecoration.left),
  top: scalePx(geo.titleDecoration.top),
  width: scalePx(geo.titleDecoration.width),
};
const bgImageStyle = {
  left: scalePx(geo.bgImage.left),
  top: scalePx(geo.bgImage.top),
  width: scalePx(geo.bgImage.width),
};
const playButtonStyle = {
  height: scalePx(geo.play.size),
  width: scalePx(geo.play.size),
};
</script>

<template>
  <section class="ui-orange gift-card-pricing-layer" data-section-id="pricing.gift-card">
    <div class="section">
      <div class="section__layer section__layer--sticky section__layer--full-height ui-background">
        <div class="sticky sticky--sticky sticky--full-height pt-promo-header">
          <div class="gift-card-section row row--gx row--stretch">
            <h2 class="sr-only">{{ GIFT_CARD.titleText.toUpperCase() }}</h2>

            <!-- `col-12` is verbatim from the measured class list: a single-hyphen no-op in the
                 reference (`.col` already defaults --grid-col-size to 12), kept so the DOM matches
                 the capture string for string. -->
            <div class="gift-card-section__content col col-12 col--6:md pr-1:md mb-1.5 mb-0:md">
              <div class="gift-card-section__title text-h2 text-box-trim">
                <div class="title">
                  <div class="title-children-wrapper">
                    <span
                      v-if="wordmark"
                      class="is-hidden:sm-down"
                      data-evidence="reference-svg-glyphs"
                      aria-hidden="true"
                      v-html="wordmark"
                    />
                    <span
                      v-else
                      class="page-title__visual text-h2"
                      data-evidence="pending-T00-subpage"
                      aria-hidden="true"
                      >{{ GIFT_CARD.titleText.toUpperCase() }}</span
                    >
                    <img
                      class="gift-card-section__title-decoration"
                      :style="titleDecorationStyle"
                      :src="GIFT_CARD.titleDecoration"
                      alt=""
                    />
                  </div>
                </div>
              </div>
              <img
                class="gift-card-section__bg-image"
                :style="bgImageStyle"
                :src="GIFT_CARD.background"
                alt=""
                aria-hidden="true"
              />
              <!-- Measured 3rd child of the left column, recovered 2026-10-01:
                   span.not-nuxt-link.btn.btn--space-between... at [19,2890,198,76].
                   76px is exactly btn--large (--btn-height: calc(var(--scale-px)*80) = 76.44px).
                   Rendered as a <span> because the reference is a span too — its click
                   destination was never captured, so no href is invented here.
                   This closes the 314px of column content previously left empty. -->
              <span class="gift-card-section__cta not-nuxt-link btn btn--space-between btn--accent btn--large">
                <span class="btn__content">{{ GIFT_CARD.ctaText }}</span>
              </span>
            </div>

            <div class="gift-card-section__form-wrapper col col-12 col--6:md">
              <div class="gift-card-section__video-preview">
                <img
                  class="gift-card-section__video-preview-img"
                  :src="GIFT_CARD.video.preview"
                  :alt="GIFT_CARD.video.lines.join(' ')"
                />
                <!-- The video source was never captured (`GIFT_CARD.video.playable` is false), so
                     this is the measured 56x56 black square with the 9x15 white triangle in it —
                     not a control, because no observed behaviour belongs to it. -->
                <span
                  class="gift-card-section__video-preview-play-btn"
                  :style="playButtonStyle"
                  data-evidence="pending-T00-subpage"
                  aria-hidden="true"
                >
                  <img class="gift-card-section__video-preview-play-icon" :src="GIFT_CARD.video.playIcon" alt="" />
                </span>
                <p class="gift-card-section__video-preview-text text-bit-small">
                  <template v-for="(line, i) in GIFT_CARD.video.lines" :key="line"
                    >
{{ line }}<br v-if="i < GIFT_CARD.video.lines.length - 1" />
</template
                  >
                </p>
              </div>

              <div class="gift-card-section__panel pt-1.25 pt-4.25:md ui-light">
                <h3 class="gift-card-section__panel-title text-h4">{{ GIFT_CARD.ctaText }}</h3>
                <p class="gift-card-section__pitch text-h4">
                  {{ GIFT_CARD.pitch }} <u>{{ GIFT_CARD.pitchUnderlined }}</u> {{ GIFT_CARD.pitchTail }}
                </p>
                <p class="gift-card-section__body text-small">{{ GIFT_CARD.body }}</p>

                <h4 class="gift-card-section__unlocks-title text-small">{{ GIFT_CARD.unlocksTitle }}</h4>
                <ul class="gift-card-section__unlocks text-small">
                  <li v-for="line in GIFT_CARD.unlocks" :key="line">{{ line }}</li>
                </ul>

                <p class="gift-card-section__closing text-small">{{ GIFT_CARD.closing }}</p>
                <p class="gift-card-section__after-purchase text-small">{{ GIFT_CARD.afterPurchase }}</p>

                <div class="buying-gift-card-form" data-evidence="pending-T00-subpage"></div>
                <hr class="gift-card-section__divider" />
                <div class="gift-card-section__trustpilot" data-evidence="pending-T00-subpage"></div>

                <p class="gift-card-section__partners-title text-bit-small">{{ GIFT_CARD.mediaTitle }}</p>
                <ul class="gift-card-section__partners">
                  <li v-for="partner in partners" :key="partner">
                    <img :src="GIFT_CARD.partnersDirectory + partner" :alt="partner.replace(/\.[a-z]+$/, '')" />
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<style>
/* CLONE-LOCAL. `.gift-card-section` and its children appear in none of the
   captured reference stylesheet chunks (see the note in
   src/content/subpages/giftCard.ts), so the rules below are the measured
   geometry transcribed by hand, scoped to this block's own class names. They sit
   in @layer components so the lifted utilities in layout.css keep winning where
   an element also carries a utility. */
@layer components {
  /* [0,2214] layer -> [0,2290] row: one --spacing-promo-header of clearance under
     the fixed promo header, plus the --spacing side gutter that puts the two
     columns at x=19 and x=698. The clearance is `padding-top` on the sticky inner
     (reference class `pt-promo-header`), not a margin on this row — same net height,
     but the padding belongs to the sticky box and a margin does not. */
  .gift-card-section {
    padding-left: var(--spacing);
    padding-right: var(--spacing);
  }
  /* measured `display:flex` on a 659x676 column; `column` is DERIVED (the only
     axis that stacks a 362px word-mark above the rest of the column at the same
     x). `position:relative` is the containing block for the two measured images. */
  .gift-card-section__content {
  /* Measured on the reference: an explicit height wins over the row's
     align-items:stretch, and the column is sticky, not static. */
  position: sticky;
  height: 676.448px;

    display: flex;
    flex-direction: column;
    position: relative;
  }
  .gift-card-section__title {
    position: relative;
  }
  /* buy.svg [126,2362,127,96] and image.png [133,2428,401,339] both overlap the
     word-mark, so neither is in flow; their left/top/width are bound in the
     template from GIFT_CARD_PRICING_GEOMETRY. */
  .gift-card-section__title-decoration,
  .gift-card-section__bg-image {
    position: absolute;
  }
  .gift-card-section__bg-image {
    height: auto;
  }
  /* the white right-hand panel: [698,2290,659,1807] over the orange layer.
     1807 is a MEASURED box and it is what makes the layer 1883 tall (1807 + the
     76px promo-header clearance). Its interior — the purchase form's field
     geometry and the Trustpilot block — was never measured, so the column is
     sized from its own measured box and the slack falls into the gap above the
     press strip (see `.gift-card-section__partners-title`), which is exactly
     where those two unmeasured regions sit on the reference.
     1807 / --scale-px = 1891. */
  .gift-card-section__form-wrapper {
    background: var(--c-white);
    display: flex;
    flex-direction: column;
    min-height: calc(var(--scale-px) * 1891);
  }
  .gift-card-section__video-preview {
    position: relative;
  }
  /* video-preview.png [698,2290,659,358] — flush to the top of the white column
     and full bleed across it. */
  .gift-card-section__video-preview-img {
    display: block;
    height: auto;
    width: 100%;
  }
  /* 56x56 black square centred on the preview; the size is bound from
     GIFT_CARD_PRICING_GEOMETRY.play. */
  .gift-card-section__video-preview-play-btn {
    align-items: center;
    background: var(--c-black);
    display: flex;
    justify-content: center;
    left: 50%;
    position: absolute;
    top: 50%;
    transform: translate(-50%, -50%);
  }
  /* media-play-white.svg measured 9x15 at [1023,2462] — the exact centre of the
     659x358 preview. */
  .gift-card-section__video-preview-play-icon {
    height: calc(var(--scale-px) * 15.7);
    width: calc(var(--scale-px) * 9.4);
  }
  /* "How / Gift Card / works?" sits bottom-left over the poster, the same slot
     `.section-2__video-preview-title` holds on the home page. It stays white
     because the surrounding `.ui-orange` layer sets --t-text to --c-white. */
  .gift-card-section__video-preview-text {
    bottom: var(--spacing);
    left: var(--spacing);
    position: absolute;
  }
  /* The reference panel carries `pt-1.25 pt-4.25:md ui-light`; the horizontal
     gutter is DERIVED (it matches the --spacing inset the left column gets from
     the row) and the bottom gutter comes from the measured tail: the last logo
     row ends at y 4011 inside a column that ends at y 4097 — 86px = 4.5 x
     --spacing. The `gap` is the design system's own --spacing step, NOT a
     measured value: the panel's block spacing was never captured, and without
     some gutter the paragraphs run into each other.
     `text-box-trim` is deliberately absent from the panel's prose. It is an
     optical trim for SINGLE-LINE blocks (that is how layer 1 uses it, on
     `.btn__text` and on each `.plans-difference__list-item-title p`); applied to
     these multi-line paragraphs it shrinks every box to cap→baseline, which made
     the pitch and the body overlap by about a line each. */
  .gift-card-section__panel {
    display: flex;
    flex: 1;
    flex-direction: column;
    gap: var(--spacing);
    padding-bottom: calc(var(--spacing) * 4.5);
    padding-left: var(--spacing);
    padding-right: var(--spacing);
  }
  /* The press strip's top edge is measured (y 3921 on the reference, i.e. 90px
     of strip + 86px of tail below the column end), so the free space above it is
     absorbed here rather than guessed into the unmeasured form / Trustpilot
     blocks. */
  .gift-card-section__partners-title {
    margin-top: auto;
  }
  .gift-card-section__unlocks {
    list-style: none;
    margin: 0;
    padding: 0;
  }
  .gift-card-section__divider {
    background: var(--t-line);
    border: 0;
    height: 1px;
    margin: var(--spacing) 0;
  }
  /* press logos: two rows of three at y 3921 and 3971, 40px tall, 10px apart.
     The three-per-row split is DERIVED from "six images, two rows" inside a
     659px column; the individual x positions were never captured. */
  .gift-card-section__partners {
    display: grid;
    gap: calc(var(--scale-px) * 10);
    grid-template-columns: repeat(3, 1fr);
    list-style: none;
    margin: 0;
    padding: 0;
  }
  .gift-card-section__partners li {
    align-items: center;
    display: flex;
    height: calc(var(--scale-px) * 42);
    justify-content: center;
  }
  .gift-card-section__partners img {
    height: 100%;
    width: auto;
  }
  /* The reference's `.title` measures 630.688px inside a 640.229px
     `.gift-card-section__title`: the difference is exactly half of
     var(--spacing) (9.552px). Without this inset the glyph set renders 640px wide
     and every x in the block drifts — the residual progress.md recorded as
     "svg 640px vs target 631px". */
  .gift-card-section__title .title {
    padding-right: calc(var(--spacing) / 2);
  }
}
</style>

<style>
/* Measured 2026-10-01 on the reference's left column (3 children, not 2):
     .gift-card-section__title  [19,2290,640,362]
     .gift-card-section__bg-image [133,2428,401,339]  position:absolute
     .gift-card-section__cta    [19,2890,198,76]
   So the CTA is content-width (198), not column-width, and it starts 238px below the
   title's bottom edge (2890 - 2652). align-self:flex-start gives the width; the
   margin-top gives the offset. Both are transcribed, neither is tuned. */
.gift-card-section__cta {
  align-self: flex-start;
  margin-top: 238px;
}
</style>
