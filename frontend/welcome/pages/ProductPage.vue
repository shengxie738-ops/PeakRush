<script setup lang="ts">
/**
 * ProductPage — /our-product.
 *
 * Measured at 1376x772: containerScrollHeight 6478 · `.nexus-intro` 1376x772 ·
 * `.card-plan` 1376x1528 at y=848 · `.card-plan__title` 1338x155 at 221.921px ·
 * one `.card-plan__panel` 433x784 (three slides in a swiper: Weekly, Annual,
 * Monthly) · `.nexus-section-2` 1376x772 · `.section-6` 1376x2521 with
 * `.section-6__slide-title` 501x155 at 221.921px · `.section-10__content`
 * 1338x546 at y=5746, `.image-trail` holding 18 photos.
 *
 * The mobile tab strip is a real selector: it drives `activePlan`, which is what
 * the reference uses to decide which panel the strip highlights and which price
 * cell is the "alt" one. Amounts are derived from SUBSCRIPTION_PRICES.
 */
import { computed, ref } from 'vue';
import SiteFooter from '@/components/SiteFooter.vue';
import PageCta from './PageCta.vue';
import PageIcon from './PageIcon.vue';
import PageTitle from './PageTitle.vue';
import { displaySvg } from '@/content/home';

/** Captured THE CARD word-mark for /our-product; '' falls back to text. */
const productWordmark = computed(() => displaySvg('product-intro')?.html ?? '');
import {
  CARD_PLAN,
  CARD_PLAN_PANELS,
  CARD_PLAN_TAB_ORDER,
  PRODUCT_INTRO,
  PRODUCT_JOIN_US,
  YOUR_CARD,
  WHERE_THE_CARD_WORKS,
  panelAmount,
  panelTabFigures,
  type BillingCycle,
} from '@/content/subpages/product';

const activePlan = ref<BillingCycle>('weekly');
</script>

<template>
  <!-- 1 · intro (ui-orange) -->
  <div class="ui-orange" data-section-id="product.intro">
    <div class="section section--under-next">
      <div class="section__layer section__layer--sticky section__layer--full-height ui-orange ui-background nexus-intro">
        <div class="nexus-intro__header px-1 pt-promo-header">
          <PageTitle
            is="h1"
            :title="PRODUCT_INTRO.heading"
            :visual="productWordmark ? [] : [PRODUCT_INTRO.heading]"
            text-class="text-h2"
            wrapper-class="nexus-intro__title-wrapper"
          >
            <!-- Captured 7-path word-mark (viewBox 0 0 1421 505), measured [19,20,1338,296].
                 Was real text at the heading scale; see displayHeadings.json `product-intro`. -->
            <span
              v-if="productWordmark"
              class="is-hidden:sm-down"
              data-evidence="reference-svg-glyphs"
              aria-hidden="true"
              v-html="productWordmark"
            />
            <img class="nexus-intro__title-decoration is-hidden:md-up img-full" :src="PRODUCT_INTRO.wordIcon" alt="" />
          </PageTitle>
        </div>

        <div class="nexus-intro__footer row row--gx row--bottom px-1 pb-1 py-1:md mt-3:md">
          <div class="col col--12 col--6:md my-2 my-0:md mt-auto">
            <p class="nexus-intro__footer-text text-box-trim">
              <span class="nexus-intro__footer-line">Always working for you.</span><br />
              <span class="nexus-intro__footer-line">QR scan sends financial support,</span><br />
              <span class="nexus-intro__footer-line">books a visit, keeps you found.</span>
              <span class="nexus-intro__text-icon-wrapper" data-evidence="pending-T00-subpage" aria-hidden="true"></span>
            </p>
          </div>
          <div class="col col--12 col--3:md col--2:xl offset--3:md offset--4:xl mt-0:md">
            <PageCta
              variant="start primary full accent large"
              label="Join"
              icon="step-next"
              icon-position="left"
              :aria-label="PRODUCT_INTRO.ctaAria"
              to="/signup"
            />
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- 2 · Find Your Card Plan (ui-pink) -->
  <div class="ui-pink" data-section-id="product.plans">
    <div class="section section--under-next">
      <div class="section__layer section__layer--sticky section__layer--full-height ui-background">
        <div class="sticky sticky--full-height pt-promo-header">
          <div class="card-plan pb-6 px-1">
            <div class="card-plan__header mb-1.75 mb-8.75:md">
              <h2 class="text-box-trim text-color-text card-plan__title text-h2-sm">{{ CARD_PLAN.title }}</h2>
              <p class="mt-2 mt-1.75:md">{{ CARD_PLAN.subtitle }}</p>
            </div>

            <div class="card-plan__sentinel"></div>

            <div class="card-plan__tabs is-hidden:md-up mb-1" role="tablist" :aria-label="CARD_PLAN.title">
              <button
                v-for="cycle in CARD_PLAN_TAB_ORDER"
                :key="cycle"
                :class="['card-plan__tab', activePlan === cycle ? 'card-plan__tab--active' : '']"
                type="button"
                role="tab"
                :aria-selected="activePlan === cycle ? 'true' : 'false'"
                data-testid="plan-tab"
                @click="activePlan = cycle"
              >
                <span class="card-plan__tab-label text-box-trim text-small">{{ panelTabFigures(cycle).label }}</span>
                <span class="card-plan__tab-price text-box-trim">{{ panelTabFigures(cycle).amount }}</span>
                <span class="card-plan__tab-price-alt text-box-trim">{{ panelTabFigures(cycle).alt }}</span>
              </button>
            </div>

            <div class="swiper card-plan__grid">
              <div class="swiper-wrapper">
                <div v-for="panel in CARD_PLAN_PANELS" :key="panel.cycle" class="swiper-slide">
                  <div :class="panel.panelClass">
                    <img v-if="panel.promoIcon" class="card-plan__promo-icon" :src="panel.promoIcon" alt="" />
                    <p class="text-box-trim mb-2 mb-3.75:md">{{ panel.title }}</p>
                    <div :class="`card-plan__description mb-2 mb-3:md${panel.cycle === 'annually' ? ' card-plan__description--large' : ''}`">
                      <p v-for="line in panel.description" :key="line" class="text-small text-box-trim">{{ line }}</p>
                    </div>
                    <ul class="card-plan__list">
                      <li v-for="item in panel.list" :key="item" class="card-plan__list-item text-bit-smaller">
                        <PageIcon name="promo-checkbox-mark" />
                        <p class="text-box-trim">{{ item }}</p>
                      </li>
                    </ul>
                    <div :class="`card-plan__cta mt-0.75 ${panel.cycle === 'annually' ? 'mt-2.25:md' : 'mt-2:md'} row`">
                      <div class="price text-color-text card-plan__price" data-testid="plan-price">
                        <p class="sr-only">{{ panelAmount(panel.cycle) }} {{ panel.srOnlyPeriod }}</p>
                        <p aria-hidden="true">
                          <span class="group group--nowrap group--v-end">
                            <span class="text-box-trim text-nowrap text-h3">{{ panelAmount(panel.cycle) }}</span>
                            <span class="text-box-trim text-nowrap text-card-base">&nbsp;{{ panel.unit }}</span>
                          </span>
                        </p>
                      </div>
                      <PageCta
                        extra-class="card-plan__cta-btn"
                        :variant="`space-between full accent ${panel.ctaVariant} large`"
                        :label="CARD_PLAN.ctaText"
                        icon="step-next"
                        :to="CARD_PLAN.ctaTo"
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
  </div>

  <!-- 3 · Your Card (ui-blue) -->
  <div class="ui-blue" data-section-id="product.card">
    <div class="section section--under-next">
      <div class="section__layer section__layer--sticky section__layer--full-height ui-background">
        <div class="nexus-section-2 row row--column:xs-down row--gx row--stretch pt-promo-header px-1 pb-1">
          <div class="nexus-section-2__header col col-12 col--6:md pr-1:md">
            <PageTitle is="h2" :title="YOUR_CARD.heading" :visual="[YOUR_CARD.heading]" text-class="text-h2-sm">
              <img class="nexus-section-2__title-decoration img-full" :src="YOUR_CARD.wordIcon" alt="" />
            </PageTitle>
          </div>

          <hr class="nexus-section-2__divider my-1 is-hidden:md-up col col-12 col--no-grow" />

          <div class="nexus-section-2__content col-divider__right:md col col-12 col--6:md">
            <div class="nexus-section-2__content-top is-hidden:sm-down">
              <div class="nexus-section-2__sub-description">
                <img class="nexus-section-2__sub-description-icon img-full" :src="YOUR_CARD.subIcon" alt="" />
              </div>
            </div>
            <hr class="mt-4 mb-1 my-1:md is-hidden:sm-down" />

            <div class="nexus-section-2__content-bottom">
              <div class="nexus-section-2__list-wrapper">
                <div class="nexus-section-2__list">
                  <p
                    v-for="(bullet, index) in YOUR_CARD.bullets"
                    :key="bullet"
                    class="nexus-section-2__promo-text nexus-section-2__slide"
                  >
                    <span :class="['underline-text-piece', index === 0 ? 'underline-text-piece--shown' : '']">
                      <span class="underline-text-piece__content">{{ bullet }}</span>
                    </span>
                  </p>
                </div>
              </div>

              <div class="nexus-section-2__list-wrapper-2">
                <div class="nexus-section-2__list-2">
                  <div class="nexus-section-2__timeline" data-evidence="pending-T00-subpage">
                    <div class="about-timelin-mobile-chart"></div>
                  </div>
                  <div class="nexus-section-2__btn-grid">
                    <div class="nexus-section-2__btn-wrapper">
                      <PageCta
                        variant="space-between full accent primary large"
                        :label="YOUR_CARD.ctaText"
                        icon="step-next"
                        to="/signup"
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
  </div>

  <!-- 4 · Where the Card works for You (ui-light) -->
  <section class="ui-light" data-section-id="product.usage">
    <div class="section section--under-next">
      <div class="section__layer section__layer--sticky ui-background">
        <div class="section-6 row row--column:xs-down row--gx px-1:md pb-1 pt-promo-header">
          <div class="section-6__header px-1 px-0:md col col-12 col--6:md">
            <div class="section-6__header-title mb-1.25 mb-0:md">
              <div class="text-box-trim text-subtitle">{{ WHERE_THE_CARD_WORKS.heading }}</div>
            </div>
            <div class="is-hidden:md-up">
              <div class="section-6__description-mobile-wrapper">
                <p class="section-6__description pt-2.25">Built to turn interest<br />into real support</p>
              </div>
            </div>
            <div class="section-6__header-media-wrapper">
              <div class="section-6__header-media mt-4:md s-hidden:sm-down">
                <div class="section-6__header-media-decoration-wrapper">
                  <img class="section-6__header-media-decoration img-full" :src="WHERE_THE_CARD_WORKS.decoration" alt="" />
                </div>
              </div>
            </div>
          </div>

          <div class="section-6__content col col-12 col--6:md col-divider__right:md mt-13.75 mt-0:md px-1 px-0:md">
            <dl class="section-6__list_color- section-6__list">
              <p class="section-6__description text-box-trim pb-7 mt-0.25:md mb-4.25 is-hidden:sm-down">
                Built to turn interest<br />into real support
              </p>
              <div
                v-for="(slide, index) in WHERE_THE_CARD_WORKS.slides.slice(0, 3)"
                :key="slide.title"
                :class="[
                  'section-6__slide',
                  index === 0 ? 'section-6__slide--first' : '',
                  `section-6__slide--color-${slide.color}`,
                ]"
              >
                <dt class="section-6__slide-title text-h2 text-box-trim">{{ slide.title }}</dt>
                <dd class="section-6__slide-description text-box-trim text-small pt-3 pt-3.75:md">
                  {{ slide.description }}
                </dd>
              </div>
              <div class="section-6__slide-footer">
                <div
                  :class="[
                    'section-6__slide',
                    'section-6__slide--last',
                    `section-6__slide--color-${WHERE_THE_CARD_WORKS.slides[3].color}`,
                  ]"
                >
                  <dt class="section-6__slide-title text-h2 text-box-trim">{{ WHERE_THE_CARD_WORKS.slides[3].title }}</dt>
                  <dd class="section-6__slide-description text-box-trim text-small pt-3 pt-4:md">
                    {{ WHERE_THE_CARD_WORKS.slides[3].description }}
                  </dd>
                </div>
                <div class="section-6__footer mt-auto pt-4 pt-0:md">
                  <div class="section-6__footer-btn mt-5.5 mt-8:md">
                    <img class="section-6__btn-icon is-hidden:md-up" :src="WHERE_THE_CARD_WORKS.ctaIcon" alt="" />
                    <PageCta
                      variant="space-between primary full accent large"
                      :label="WHERE_THE_CARD_WORKS.ctaText"
                      icon="step-next"
                      to="/signup"
                    />
                  </div>
                </div>
              </div>
            </dl>
          </div>
        </div>
      </div>
    </div>
  </section>

  <!-- 5 · Join Us + footer (ui-orange) -->
  <section class="ui-orange wrapper-section-10" data-page-header-theme="orange" data-section-id="product.join">
    <div class="section">
      <div class="section__layer section__layer--sticky section__layer--full-height ui-background">
        <div class="sticky sticky--full-height px-1 pb-1 pt-promo-header">
          <div class="section-10">
            <div class="section-10__content row row--gx row--stretch">
              <div class="col col-12 col--6:md pr-1:md section-10__content-col">
                <PageTitle is="h2" :title="PRODUCT_JOIN_US.heading" :visual="[PRODUCT_JOIN_US.heading]" text-class="text-h2" />
                <div class="image-trail image-trail--active" aria-hidden="true">
                  <div
                    v-for="(photo, index) in PRODUCT_JOIN_US.trailOrder"
                    :key="photo"
                    :class="[
                      'image-trail__photo',
                      `image-trail__photo--${index + 1}`,
                      index < 3 ? `image-trail__photo--active-${index + 1}` : '',
                    ]"
                  >
                    <picture class="img-full">
                      <img :src="PRODUCT_JOIN_US.trailPath(photo)" alt="" />
                    </picture>
                  </div>
                </div>
              </div>

              <div class="section-10__content-side col col-12 col--6:md col-divider__right:md mt-6.5 mt-0:md">
                <p class="section-10__description text-box-trim">
                  <span class="underline-text-piece underline-text-piece--shown">
                    <span class="underline-text-piece__content">{{ PRODUCT_JOIN_US.descriptionLead }}</span>
                  </span>
                  {{ PRODUCT_JOIN_US.descriptionTail }}
                </p>
                <div class="section-10__btn-grid">
                  <div class="section-10__btn-wrapper mt-5.5 mt-7:md">
                    <div class="section-10__btn-icon">
                      <img class="icon-shake-reverse img-full" :src="PRODUCT_JOIN_US.ctaIcon" alt="" />
                    </div>
                    <div>
                      <PageCta
                        variant="start primary full accent large"
                        :label="PRODUCT_JOIN_US.ctaText"
                        icon="step-next"
                        :aria-label="PRODUCT_JOIN_US.ctaAria"
                        to="/signup"
                      />
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

<style>
@layer components {
  .nexus-intro {
    display: flex;
    flex-direction: column;
    justify-content: space-between;
  }
  .nexus-intro__header {
    flex: 1 1 0;
  }
  .nexus-intro__title-wrapper {
    position: relative;
  }
  .nexus-intro__title-decoration {
    left: var(--md, 6.5%) var(--n-md, 11%);
    position: absolute;
    top: var(--md, 23.5%) var(--n-md, 5%);
    width: var(--md, 9.7183098592%) var(--n-md, 29.1428571429%);
  }
  .nexus-intro__footer {
    display: flex;
    flex: 1 1 0;
    flex-direction: var(--md, row) var(--n-md, column);
    justify-content: space-between;
    margin-bottom: var(--cookie-message-mobile-height, 0);
    position: relative;
  }
  .nexus-intro__footer-text {
    font-size: var(--md, calc(var(--scale-text-rem) * 5.1)) var(--n-md, calc(var(--scale-text-rem) * 3.2));
    --lh: var(--md, calc(var(--scale-text-rem) * 5.5)) var(--n-md, calc(var(--scale-text-rem) * 3.5));
    line-height: var(--lh);
  }
  .nexus-intro__text-icon-wrapper {
    align-items: baseline;
    display: inline-flex;
    gap: 3px;
    position: relative;
  }

  .card-plan {
    display: flex;
    flex-direction: column;
  }
  .card-plan__sentinel {
    height: 0;
    position: relative;
  }
  .card-plan__tabs {
    background: rgb(197, 147, 157);
    display: flex;
    margin-left: calc(var(--spacing) * -1);
    padding: var(--spacing);
    position: sticky;
    top: 40px;
    width: calc(100% + var(--spacing) * 2);
    z-index: 2;
  }
  .card-plan__tab {
    background: transparent;
    border: 1px solid var(--t-text);
    color: var(--t-text);
    cursor: pointer;
    display: flex;
    flex: 1 1 0;
    font: inherit;
    height: 80px;
    justify-content: space-between;
    padding: calc(var(--scale-px) * 9) calc(var(--scale-px) * 8);
    position: relative;
    text-align: left;
  }
  .card-plan__tab:not(:first-child) {
    border-left: 0;
  }
  .card-plan__tab-price {
    bottom: 10px;
    opacity: 0;
    position: absolute;
    right: 50%;
  }
  .card-plan__tab-price-alt {
    bottom: 10px;
    left: 10px;
    opacity: 1;
    position: absolute;
  }
  .card-plan__tab--active {
    background: var(--c-black);
    color: var(--c-white);
  }
  /* Swiper is not part of this build; the measured DOM contract is kept and the
     three slides are laid out as the desktop row the library produces. */
  .card-plan__grid .swiper-wrapper {
    display: flex;
    gap: var(--spacing);
  }
  .card-plan__grid .swiper-slide {
    flex: 1 1 0;
  }
  .card-plan__list {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-tiny);
    list-style: none;
    margin: 0;
    padding: 0;
  }
  .card-plan__list-item {
    align-items: flex-start;
    display: flex;
    gap: var(--spacing-tiny);
  }
  .card-plan__price .text-h3 {
    font-size: var(--md, calc(var(--scale-text-rem) * 2.6)) var(--n-md, calc(var(--scale-text-rem) * 2.1));
  }
  .card-plan__cta {
    align-items: flex-end;
    gap: var(--spacing);
    justify-content: space-between;
  }
  .card-plan__promo-icon {
    height: calc(var(--scale-px) * 40);
    position: absolute;
    right: var(--spacing);
    top: var(--spacing);
    width: calc(var(--scale-px) * 26);
  }
  @media (max-width: 979px) {
    .card-plan__grid .swiper-slide {
      display: none;
    }
    .card-plan__grid .swiper-slide:nth-child(1) {
      display: block;
    }
  }

  .nexus-section-2__title-decoration {
    left: var(--md, 8%) var(--n-md, 12%);
    position: absolute;
    top: var(--md, 30%) var(--n-md, 8%);
    width: var(--md, 9.7183098592%) var(--n-md, 29.1428571429%);
  }
  .nexus-section-2__content {
    display: flex;
    flex-direction: column;
    gap: var(--spacing);
  }
  .nexus-section-2__list {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-small);
  }
  .nexus-section-2__promo-text {
    margin: 0;
  }
  .nexus-section-2__list-2 {
    display: grid;
    gap: var(--spacing);
    grid-template-columns: 1fr auto;
  }
  .nexus-section-2__timeline .about-timelin-mobile-chart {
    background: var(--t-avatar);
    min-height: calc(var(--scale-px) * 120);
  }

  .section-6__list {
    display: flex;
    flex-direction: column;
    margin: 0;
  }
  .section-6__slide-title {
    font-size: var(--md, calc(var(--scale-text-rem) * 12)) var(--n-md, calc(var(--scale-text-rem) * 6));
    --lh: 1.05;
    line-height: var(--lh);
    margin: 0;
  }
  .section-6__slide--color-green .section-6__slide-title {
    color: var(--c-green);
  }
  .section-6__slide--color-orange .section-6__slide-title {
    color: var(--c-orange);
  }
  .section-6__slide--color-pink .section-6__slide-title {
    color: var(--c-pink);
  }
  .section-6__slide--color-blue .section-6__slide-title {
    color: var(--c-blue);
  }
  .section-6__slide-description {
    margin: 0;
  }
  .section-6__footer-btn {
    position: relative;
  }
  .section-6__btn-icon {
    left: calc(var(--scale-px) * -60);
    position: absolute;
    top: -40%;
    width: calc(var(--scale-px) * 60);
  }
}
</style>
