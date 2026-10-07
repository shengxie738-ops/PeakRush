<script setup lang="ts">
/**
 * PricingPage — /pricing.
 *
 * Measured at 1376x772 (in-app browser, 2026-09-30):
 *   containerScrollHeight 4280 · `.subscription-and-pricing` 1376x2118 at y=76
 *   `.plans-difference` 1338x1380 at y=1766 · frame 545x1380 at x=134
 *   `.radio-group` 267x29 at x=153 y=2840 · `.price` 138x19 · CTA 188x76
 *   h1.sr-only "Subscription & Pricing" → computed 250.148px Hardbop 700, lh 194.668
 *   the visible word-mark is an inline SVG (viewBox "0 0 1420 500", 12 paths,
 *   1338px wide) whose glyph set was never downloaded → visual copy falls back to
 *   the reference .text-h2 scale (221.921px) and is marked pending-T00-subpage.
 *
 * The billing radio is a real single-select group (name="type") and every figure on
 * the page is derived from SUBSCRIPTION_PRICES through ./subpages/pricing.
 *
 * The reference route has TWO `.section__layer--sticky` blocks — subscription
 * [0,0,1376,2214] on pink #c5939d and a GIFT CARD block [0,2214,1376,1883] on orange
 * #f4793a — which is why this file renders two sibling sections and why the clone's
 * scrollHeight is measured against 4282, not against the 2214 of the first layer.
 * The second block lives in @/components/PricingGiftCardSection.vue.
 */
import { computed, ref } from 'vue';
import BrushLink from '@/components/BrushLink.vue';
import PricingGiftCardSection from '@/components/PricingGiftCardSection.vue';
import PromoFooter from '@/components/PromoFooter.vue';
import TextSwap from '@/components/TextSwap.vue';
import { displaySvg } from '@/content/home';

/** The captured 12-path SUBSCRIPTION glyph set (viewBox 0 0 1420 500). */
const pricingWordmark = computed(() => displaySvg('pricing-title')?.html ?? '');
import PageCta from './PageCta.vue';
import PageIcon from './PageIcon.vue';
import {
  BILLING_CYCLES,
  DEFAULT_BILLING_CYCLE,
  PLAN_CARDS,
  PRICING_PAGE,
  PROMO_COMPARISONS,
  PROMO_SENTENCE,
  PRO_FEATURE_GROUPS,
  STARTER_FEATURE_GROUPS,
  STARTER_PRICE_LABEL,
  cycleById,
  type BillingCycle,
  type PlanCard,
} from '@/content/subpages/pricing';

const cycle = ref<BillingCycle>(DEFAULT_BILLING_CYCLE);
const selected = computed(() => cycleById(cycle.value));

/**
 * The two frames of one `.plans-difference`, as measured row-by-row in
 * evidence/reference/pricing-plans-difference-measured.md. They are not one table with per-plan
 * flags: Starter renames two rows, reorders `Sharing`, drops the tooltip from disabled rows, and
 * wraps every row in its own `ul.plans-difference__sub-list` (11 sub-lists) where Pro groups a
 * category's rows into one (5 sub-lists). `lists` carries that grouping so the item markup exists
 * once.
 */
function groupsFor(card: PlanCard) {
  const isPro = card.id === 'pro';
  const source = isPro ? PRO_FEATURE_GROUPS : STARTER_FEATURE_GROUPS;
  return source.map((group) => {
    const rows = group.rows.map((row) => {
      const classes =
        isPro && row.freeForPro
          ? ['plans-difference__list-item_free', 'plans-difference__list-item', 'text-h4', 'row', 'row--middle']
          : row.disabled
            ? ['plans-difference__list-item_disabled', 'is-hidden:sm-down', 'plans-difference__list-item', 'text-h4', 'row', 'row--middle']
            : ['plans-difference__list-item', 'text-h4', 'row', 'row--middle'];
      return { label: row.label, tooltip: row.tooltip, itemClass: classes.join(' '), disabled: row.disabled === true };
    });
    return {
      title: group.title,
      hiddenOnSmall: !isPro && group.hiddenOnSmall === true,
      lists: isPro ? [rows] : rows.map((row) => [row]),
    };
  });
}

/** The promo sentence splits into three measured nodes: lead, figure, comparisons. */
const promoFigure = computed(() => selected.value.promoFigure);
</script>

<template>
  <div class="ui-pink" data-section-id="pricing">
    <!-- No `section--under-next` here. That modifier sets `--s-und:100svh`, which
         gives the sticky layer 772px of travel and pins it for a whole extra
         viewport. The reference does not pin this layer: the black Pro Card frame
         measures y=662 in V17 (scroll 0) and y=62 in V18 (scroll 600), i.e. the
         same document position 662 — it scrolls normally. The clone's V18 read
         51.14 % purely because the pin moved the plans down by the scroll offset
         while the reference left them in place. Layer 1's box is unchanged either
         way (the 772px tail was cancelled by `margin-bottom:-100svh`), so this is
         a pin fix, not a height fix. -->
    <div class="section">
      <div
        class="section__layer section__layer--sticky section__layer--full-height subscription-and-pricing-section-layer ui-background"
      >
        <div class="sticky sticky--sticky sticky--full-height pb-1:md pt-promo-header">
          <div class="subscription-and-pricing row row--gx row--stretch px-1">
            <div class="col col--12">
              <h1 class="sr-only">{{ PRICING_PAGE.heading }}</h1>
              <div class="title subscription-and-pricing__title">
                <h2 class="sr-only">{{ PRICING_PAGE.subheading }}</h2>
                <div class="title-children-wrapper">
                  <!-- The reference paints this word as a 12-path glyph set, not text.
                       Captured 2026-10-01 into displayHeadings.json (see
                       scripts/extract-subpage-svgs.mjs); an earlier revision fell back to
                       `text-h2` real text, which is why the heading rendered ~4x too small. -->
                  <span
                    v-if="pricingWordmark"
                    class="subscription-and-pricing__title-desktop"
                    data-evidence="reference-svg-glyphs"
                    aria-hidden="true"
                    v-html="pricingWordmark"
                  />
                  <span
                    v-else
                    class="subscription-and-pricing__title-desktop page-title__visual text-h2"
                    data-evidence="pending-T00-subpage"
                    aria-hidden="true"
                    >Subscription &amp; Pricing</span
                  >
                  <img
                    v-if="PRICING_PAGE.titleDecoration"
                    class="subscription-and-pricing__title-decoration img-full"
                    :src="PRICING_PAGE.titleDecoration"
                    alt=""
                  />
                </div>
              </div>
            </div>

            <div
              class="plans-difference row row--gx row--gy row--stretch col col--12 plans-difference--md plans-difference--page-variant mt-4 mt-6:md px-6:md mb-4 mb-8:md"
            >
              <div v-for="card in PLAN_CARDS" :key="card.id" :class="card.frameClass">
                <img v-if="card.icon" class="plans-difference__subscription-icon" :src="card.icon" alt="" />

                <p class="text-lead mb-0.75 mb-1:md text-box-trim">{{ card.title }}</p>
                <p class="text-small mb-2 mb-3.25:md text-color-small">{{ card.tagline }}</p>

                <ul class="plans-difference__list col col--12">
                  <li v-for="group in groupsFor(card)" :key="group.title" :class="group.hiddenOnSmall ? 'is-hidden:sm-down' : ''">
                    <p class="plans-difference__list-title text-box-trim text-smaller text-color-small">{{ group.title }}</p>
                    <ul v-for="(list, listIndex) in group.lists" :key="listIndex" class="plans-difference__sub-list">
                      <li v-for="row in list" :key="row.label" :class="row.itemClass">
                        <div class="plans-difference__list-item-title row row--middle">
                          <p class="text-box-trim">
                            {{ row.label }}<template v-if="row.tooltip">&nbsp;&nbsp;</template>
                          </p>
                          <div v-if="row.tooltip" class="tooltip-wrapper">
                            <div class="tooltip ui-background tooltip--default tooltip--top-start tooltip--arrow-inverse ui-light">
                              <p class="plans-difference__tooltip-content text-smaller text-box-trim">{{ row.tooltip }}</p>
                              <div class="tooltip__arrow tooltip__arrow_reversed"></div>
                            </div>
                            <div class="tooltip-trigger--hover tooltip-trigger">
                              <div class="plans-difference__question-mark-wrapper">
                                <PageIcon name="hover" extra-class="plans-difference__question-mark-hover" />
                                <PageIcon name="question-mark" extra-class="plans-difference__question-mark-icon" />
                              </div>
                            </div>
                          </div>
                        </div>
                        <!-- A disabled row puts the 24-unit promo-more-close inside a 20-unit
                             relative wrapper; an included row paints the 20-unit
                             promo-stage-current bare. Both measured. -->
                        <div
                          v-if="row.disabled"
                          class="plans-difference__subscription-status-icon_not-subscribed-wrapper"
                        >
                          <PageIcon
                            name="promo-more-close"
                            extra-class="plans-difference__subscription-status-icon plans-difference__subscription-status-icon_not-subscribed is-hidden:sm-down"
                          />
                        </div>
                        <PageIcon
                          v-else
                          name="promo-stage-current"
                          extra-class="plans-difference__subscription-status-icon plans-difference__subscription-status-icon_subscribed is-hidden:sm-down"
                        />
                      </li>
                    </ul>
                  </li>
                </ul>

                <!-- Pro frame: billing cycle radio group + promo + two price cells -->
                <template v-if="card.id === 'pro'">
                  <div class="group mt-2 mt-3:md">
                    <div class="radio-group radio-group--no-padding">
                      <div class="radio-group__options">
                        <div v-for="option in BILLING_CYCLES" :key="option.id" class="radio-group__options-item">
                          <label class="form-label form-label--with-input input-radio input--radio-custom">
                            <input
                              v-model="cycle"
                              class="input-radio__input sr-only"
                              :name="PRICING_PAGE.radioName"
                              type="radio"
                              :value="option.id"
                              data-testid="billing-cycle"
                            />
                            <span class="input-radio__fake"></span>
                            <span class="text-box-trim form-label__text">
                              <span
                                :class="`not-nuxt-link btn btn--no-role btn--full ${cycle === option.id ? 'btn--secondary' : 'btn--outline'} btn--accent btn--smallish btn--text-text-small`"
                                title=""
                              >
                                <span class="btn__content">
                                  <span class="btn__text">
                                    <PageIcon name="hover" extra-class="btn__hover-accent btn__hover-accent--text" />
                                    <span class="btn__text-text">{{ option.label }}</span>
                                  </span>
                                </span>
                              </span>
                            </span>
                          </label>
                        </div>
                      </div>
                      <div class="transition-height error-list"></div>
                    </div>
                  </div>

                  <p class="text-small text-box-trim mt-3.25" data-testid="promo-line">
                    {{ PROMO_SENTENCE.lead }}
                    <BrushLink underline show underline-variant="accent" :transition-delay="0">{{ promoFigure }}</BrushLink>
                    <br class="is-hidden:sm-down" />
                    {{ PROMO_SENTENCE.middle }}
                    <TextSwap :items="PROMO_COMPARISONS" />
                  </p>

                  <div class="mt-3.75 mt-3.25:md plans-difference__footer row row--bottom row--gx row--gy">
                    <div class="plans-difference__footer__prices row">
                      <div class="mr-1">
                        <div class="price text-color-text" data-testid="price-primary">
                          <p class="sr-only">{{ selected.primary.srOnly }}</p>
                          <p class="text-color-heading" aria-hidden="true">
                            <span class="group group--nowrap group--v-end">
                              <span class="text-box-trim text-nowrap text-base">{{ selected.primary.amount }}</span>
                              <span class="text-box-trim text-nowrap text-smaller">&nbsp;{{ selected.primary.unit }}</span>
                            </span>
                          </p>
                        </div>
                      </div>
                      <div class="mr-1">
                        <div class="price text-color-text" data-testid="price-annualised">
                          <p class="sr-only">{{ selected.annualised.srOnly }}</p>
                          <p aria-hidden="true">
                            <span class="group group--nowrap group--v-end">
                              <span class="text-box-trim text-nowrap text-base">{{ selected.annualised.amount }}</span>
                              <span class="text-box-trim text-nowrap text-smaller">&nbsp;{{ selected.annualised.unit }}</span>
                            </span>
                          </p>
                        </div>
                      </div>
                    </div>
                    <div class="plans-difference__footer-btn-wrapper ml-0 ml-auto:md">
                      <PageCta
                        extra-class="plans-difference__cta-btn ml-auto"
                        variant="space-between full accent secondary large"
                        label="Join"
                        icon="step-next"
                        :to="card.ctaTo"
                      />
                    </div>
                  </div>
                </template>

                <!-- Starter frame: the measured "Pricing / Free" block -->
                <div v-else class="mt-2 mt-2.25:md mt-auto:md plans-difference__footer row row--bottom">
                  <div class="col col--12 col--7:md">
                    <div class="text-smaller mb-0.5 text-box-trim text-color-small">Pricing</div>
                    <p class="text-box-trim">{{ STARTER_PRICE_LABEL }}</p>
                  </div>
                  <div class="col col--12 col--5:md plans-difference__footer-btn-wrapper ml-auto">
                    <PageCta
                      extra-class="plans-difference__cta-btn ml-auto"
                      variant="space-between full accent secondary large"
                      label="Join"
                      icon="step-next"
                      :to="card.ctaTo"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
  <!-- Second sticky layer of the reference route: the GIFT CARD block, orange,
       [0,2214,1376,1883]. It is a sibling section, not part of the pink one. -->
  <PricingGiftCardSection />
  <!-- DIFF-015: the reference closes /pricing with the compact promo footer,
       footer.promo-footer at y=4097.94 h=185.21 — a third flow child, not a third
       sticky layer. The .section-10__footer that <SiteFooter shell> models is
       home's footer and does not exist on this route. -->
  <PromoFooter theme="ui-orange" />
</template>

<style>
/* CLONE-LOCAL cascade order is declared in every src/styles/*.css file; the
   pricing rules below are transcribed from the live page's matched CSSOM rules
   (layer "components") so the lifted utilities keep winning where they should. */
@layer components {
  /* No background here on purpose. This rule previously forced
     `background: var(--c-orange)` and claimed to be transcribed from the live CSSOM,
     but the frozen reference frames disagree: every sampled point of
     evidence/reference/captured/2026-10-01/V17-_pricing@inapp.png and V18 is
     rgb(197,147,157) = #c5939d, and the route probe measured the same. The element
     already carries `ui-background`, whose `var(--t-background)` resolves to
     #c5939d through the `.ui-pink` ancestor — so the correct rule is no rule, and
     leaving the override in place out-specifies the theme utility. */
  .subscription-and-pricing__title {
    position: relative;
  }
  .subscription-and-pricing__title-desktop {
    position: relative;
    top: -5px;
  }
  /* Reference word-mark is `svg{width:100%}` of a 1420x500 viewBox; the text
     fallback is capped so it cannot push the page wider than the grid. */
  .subscription-and-pricing__title .page-title__visual {
    font-size: var(--md, calc(var(--scale-text-rem) * 11)) var(--n-md, calc(var(--scale-text-rem) * 6));
    line-height: 1.05;
  }

  .plans-difference {
    display: flex;
    justify-content: space-between;
  }
  .plans-difference--page-variant {
    gap: var(--spacing);
  }
  .plans-difference__frame {
    background: var(--t-background);
    flex: var(--md, 1 0 calc(50% - var(--spacing))) var(--n-md, 1 0 100%);
    position: relative;
  }
  .plans-difference__frame_free {
    box-shadow: 0 0 1px 1px inset var(--t-line);
    display: flex;
    flex-direction: column;
  }
  .plans-difference__frame_free .plans-difference__subscription-status-icon {
    color: var(--t-text);
  }
  .plans-difference__frame_free .plans-difference__list-item_disabled .plans-difference__subscription-status-icon {
    color: var(--t-line);
  }
  .plans-difference__frame_upgraded {
    box-shadow: 0 0 0 1px inset var(--c-black);
  }
  .plans-difference__frame_upgraded .plans-difference__subscription-status-icon {
    color: var(--t-accent);
  }
  .plans-difference__frame_upgraded .plans-difference__list-item_free .plans-difference__subscription-status-icon {
    color: var(--t-heading);
  }
  .plans-difference__subscription-icon {
    height: var(--md, calc(var(--scale-px) * 97)) var(--n-md, calc(var(--scale-px) * 40));
    position: absolute;
    right: var(--md, 3.4%) var(--n-md, -3.3%);
    top: var(--md, -2.7%) var(--n-md, -1.6%);
    width: var(--md, calc(var(--scale-px) * 59)) var(--n-md, calc(var(--scale-px) * 26));
  }
  .plans-difference__list {
    display: flex;
    flex-direction: column;
    gap: var(--md, calc(var(--spacing) * 1.5)) var(--n-md, calc(var(--spacing) * 1.25));
    list-style: none;
    margin: 0;
    padding: 0;
  }
  .plans-difference__sub-list {
    margin: 0;
    padding: 0;
  }
  .plans-difference__list-title {
    box-shadow: 0 1px 0 0 var(--t-line);
    padding-bottom: var(--md, calc(var(--spacing) * 0.75)) var(--n-md, var(--spacing));
    padding-top: calc(var(--spacing) * 0.75);
  }
  .plans-difference__list-item {
    box-shadow: 0 1px 0 0 var(--t-line);
    display: flex;
    justify-content: space-between;
  }
  /* `height: 50px` is a top-level reference rule scoped to the size variant, not content-derived.
     Without it every row is content-driven at 43.94px, which is the whole of the 61.15px that made
     `.subscription-and-pricing` 2057 instead of 2118.23. */
  .plans-difference--md .plans-difference__list-item {
    height: 50px;
    padding-bottom: calc(var(--spacing) * 0.75);
    padding-top: calc(var(--spacing) * 0.75);
  }
  .plans-difference__list-item_disabled {
    color: var(--t-line);
  }
  .plans-difference__list-item-title {
    gap: var(--spacing-tiny);
  }
  /* Measured: 13.698630137vw = 188px at 1376. Without it the Starter/Pro CTA is content-sized
     (89px), prices + button fit on one flex line, and `.plans-difference__footer` is 76.44 tall
     instead of the reference 95.23 — the button is meant to force a wrap under the prices. */
  .plans-difference--md .plans-difference__cta-btn {
    min-width: var(--md, 13.698630137vw) var(--n-md, 100%);
  }
  .plans-difference__question-mark-wrapper {
    display: flex;
    position: relative;
  }
  .plans-difference__question-mark-icon {
    height: calc(var(--scale-px) * 14);
    opacity: 0.6;
    position: relative;
    transition: opacity 0.3s cubic-bezier(0.25, 0.74, 0.22, 0.99);
    width: calc(var(--scale-px) * 14);
  }
  .plans-difference__question-mark-hover {
    color: var(--t-accent);
    height: 100%;
    inset: 50% 0 0 50%;
    opacity: 0;
    position: absolute;
    transform: translate(-50%, -50%);
    transition: opacity 0.3s cubic-bezier(0.25, 0.74, 0.22, 0.99);
    width: var(--md, calc(100% + 4px)) var(--n-md, calc(100% + 6.5px));
  }
  .plans-difference__subscription-status-icon {
    height: calc(var(--scale-px) * 16);
    width: calc(var(--scale-px) * 16);
  }
  /* The tick is 20 units (19.104px), not 16 (15.281px); the cross is 24 units inside a 20-unit
     relative wrapper. Both measured off the reference stylesheet. */
  .plans-difference__subscription-status-icon_not-subscribed-wrapper,
  .plans-difference__subscription-status-icon_subscribed {
    height: calc(var(--scale-px) * 20);
    position: relative;
    width: calc(var(--scale-px) * 20);
  }
  .plans-difference__subscription-status-icon_subscribed {
    right: -2px;
    top: 2px;
  }
  .plans-difference__subscription-status-icon_not-subscribed {
    height: calc(var(--scale-px) * 24);
    position: absolute;
    width: calc(var(--scale-px) * 24);
  }
  .plans-difference .tooltip-wrapper {
    left: -2px;
    position: relative;
  }
  .plans-difference .tooltip {
    display: none;
    left: 50%;
    position: absolute;
    top: 0;
    transform: translate(-50%, calc(-100% - calc(var(--scale-px) * 10)));
    width: max-content;
    z-index: 3;
  }
  .plans-difference .tooltip-wrapper:hover .tooltip,
  .plans-difference .tooltip-wrapper:focus-within .tooltip {
    display: block;
  }
  .plans-difference .tooltip-wrapper:hover .plans-difference__question-mark-hover,
  .plans-difference .tooltip-wrapper:hover .plans-difference__question-mark-icon {
    opacity: 1;
  }
  .plans-difference__tooltip-content {
    max-width: var(--md, calc(var(--scale-px) * 240)) var(--n-md, none);
  }
  .tooltip__arrow {
    display: none;
  }
  .plans-difference__footer {
    display: flex;
    gap: var(--md, 0) var(--n-md, calc(var(--scale-px) * 20));
  }
  .plans-difference__footer__prices {
    gap: calc(var(--scale-px) * 10);
  }
  .plans-difference .form-label__text,
  .plans-difference__footer-btn-wrapper {
    display: flex;
  }
  .plans-difference--md .plans-difference__footer-btn-wrapper {
    width: var(--md, auto) var(--n-md, 100%);
  }
  /* The comparison rotator is src/components/TextSwap.vue: the reference overlaps the words in one
     grid cell and moves them with `transition` on transform + clip-path, not a keyframe fade. */

  /* --- the billing cycle radio group (measured DOM, custom-styled) --- */
  .radio-group__options {
    display: flex;
    padding-bottom: var(--md, calc(var(--scale-px) * 10)) var(--n-md, calc(var(--scale-px) * 15));
    padding-top: var(--md, calc(var(--scale-px) * 10)) var(--n-md, calc(var(--scale-px) * 15));
  }
  .radio-group__options-item + .radio-group__options-item {
    margin-left: -1px;
  }
  .radio-group--no-padding .radio-group__options {
    padding-bottom: 0;
    padding-top: 0;
  }
  .input--radio-custom {
    display: block;
  }
  .input--radio-custom .input-radio__fake {
    display: none;
  }
  .input-radio {
    --radio-group-size: calc(var(--scale-px) * 20);
    --radio-group-inner-size: calc(var(--scale-px) * 14);
    --input-label: var(--t-input_radio_label);
    --input-border: var(--t-input_radio_border);
    --input-accent: var(--t-input_radio_accent);
    --input-hovered-label: var(--t-input_radio_hovered-label);
    --input-hovered-border: var(--t-input_radio_hovered-border);
    --input-active-label: var(--t-input_radio_label);
    transition: color 0.2s;
  }
  .input-radio .input-radio__fake {
    border: 1px solid;
    border-color: var(--input-border);
    border-radius: 100%;
    display: block;
    flex-shrink: 0;
    height: var(--radio-group-size);
    position: relative;
    transition: border-color 0.2s;
    width: var(--radio-group-size);
  }
  .input-radio:not(.is-disabled) .btn {
    cursor: pointer;
  }
  .input-radio:where(:has(input:checked)) .btn {
    --btn-text: var(--t-input_radio_active-label, var(--t-text));
  }
  .form-label--with-input {
    align-items: center;
    cursor: pointer;
    display: flex;
    gap: var(--spacing-tiny);
  }
  .transition-height {
    overflow: hidden;
  }
  .error-list:empty {
    display: none;
  }
}
</style>
