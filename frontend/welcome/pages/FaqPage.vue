<script setup lang="ts">
/**
 * FaqPage — /faq.
 *
 * Measured at 1376x772: containerScrollHeight 2336 · `.faq-section` 1338x2055 at
 * y=76 · left `.faq-section__content` 659x676 (sticky) · `.faq-section__cards`
 * 434x1988 at x=810 · one `.faq-section__card` 434x317 · group `h2.text-base`
 * 395x19 · question `h3` 348x12 (15.5734px HeadingNow) · answer block 348x51.
 * The H1 is genuine text with the reference `.text-h2` scale (221.921px Hardbop
 * 700, line-height 175.201px) and a 150x155 box — no glyph SVG here.
 *
 * Accordion behaviour was verified by clicking the live page: only the 19
 * SUB-GROUP headers are buttons; questions inside an open group are all visible;
 * groups are MULTI-open (opening one never closes another).
 */
import { ref } from 'vue';
import SiteFooter from '@/components/SiteFooter.vue';
import PageIcon from './PageIcon.vue';
import RichText from './RichText.vue';
import { FAQ_GROUPS, FAQ_PAGE, type FaqSubGroup } from '@/content/subpages/faq';

/** regionIds currently expanded — a Set, so toggling is O(1) and independent. */
const open = ref<Set<string>>(new Set());

function buttonId(sub: FaqSubGroup): string {
  return `${sub.regionId}-button`;
}

function toggle(regionId: string): void {
  const next = new Set(open.value);
  if (next.has(regionId)) next.delete(regionId);
  else next.add(regionId);
  open.value = next;
}
</script>

<template>
  <div class="ui-green" data-section-id="faq">
    <div class="section">
      <div class="section__layer section__layer--full-height ui-background">
        <div class="sticky sticky--full-height px-1 pb-1 pt-promo-header">
          <div class="faq-section row row--gx row--stretch">
            <div class="faq-section__content col col-12 col--6:md pr-1:md">
              <h1 class="faq-section__title text-h2 text-box-trim">
                {{ FAQ_PAGE.heading }}
                <span
                  class="faq-section__title-decorations"
                  data-evidence="pending-T00-subpage"
                  aria-hidden="true"
                ></span>
              </h1>
              <hr class="mt-4 mb-1 my-1:md is-hidden:md-up" />
              <div class="faq-section__content-texts mb-4.25 mb-0:md mt-auto:md">
                <p class="faq-section__description text-box-trim">
                  {{ FAQ_PAGE.description.replace('help@follow.art', '') }}
                  <a :href="FAQ_PAGE.descriptionLink">help@follow.art</a>
                </p>
              </div>
            </div>

            <div class="faq-section__cards-wrapper col col-12 col--6:md col-divider__right:md">
              <div class="faq-section__cards-wrapper-decoration" aria-hidden="true"></div>
              <div class="faq-section__cards mt-0 mt-3.5:md ui-dark">
                <section v-for="group in FAQ_GROUPS" :key="group.title" class="faq-section__card px-1 pt-1 pb-1.5">
                  <h2 class="text-base mb-3 mb-4:md text-box-trim">{{ group.title }}</h2>

                  <div
                    v-for="sub in group.subGroups"
                    :key="sub.regionId"
                    :class="['faq-section__card-list-item', open.has(sub.regionId) ? 'faq-section__card-list-item--active' : '']"
                  >
                    <button
                      :id="buttonId(sub)"
                      class="faq-section__card-list-item-header"
                      type="button"
                      :aria-expanded="open.has(sub.regionId) ? 'true' : 'false'"
                      :aria-controls="sub.regionId"
                      data-testid="faq-toggle"
                      @click="toggle(sub.regionId)"
                    >
                      <span class="faq-section__card-list-item-header-text-item text-small text-color-small text-box-trim">
                        {{ sub.label }}
                      </span>
                      <PageIcon name="select-list-arrow" extra-class="faq-section__card-list-item-header-icon" />
                    </button>

                    <div class="transition-height overflow-hidden">
                      <div
                        :id="sub.regionId"
                        class="mt-1 mt-1.5:md"
                        role="region"
                        :aria-labelledby="buttonId(sub)"
                        v-show="open.has(sub.regionId)"
                      >
                        <ul
                          :class="[
                            'faq-section__card-list-item-internal-list',
                            'text-card-lead',
                            sub.numbered ? 'faq-section__card-list-item-internal-list--with-counter' : '',
                          ]"
                        >
                          <li v-for="item in sub.questions" :key="`${sub.regionId}-${item.question || item.answer[0]}`" class="faq-section__card-list-item-internal-list-item">
                            <div>
                              <h3 v-if="item.question" class="text-card-lead faq-section__faq-step-header text-box-trim">
                                {{ item.question }}
                              </h3>
                              <RichText class="faq-section__faq-step-content" :blocks="item.answer" />
                            </div>
                          </li>
                        </ul>
                        <hr class="faq-section__card-list-item-border col col--12 mt-3.25 mt-4:md" />
                      </div>
                    </div>
                  </div>
                </section>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
  <SiteFooter shell :description="FAQ_PAGE.description" />
</template>

<style>
@layer components {
  .faq-section b {
    color: var(--t-text);
  }
  .faq-section__title {
    position: relative;
    width: fit-content;
  }
  .faq-section__content {
    display: flex;
    flex-direction: column;
    position: static;
  }
  .faq-section__content {
    height: calc(100svh - var(--spacing-promo-header) - var(--spacing));
    position: sticky;
    top: var(--spacing-promo-header);
  }
  .faq-section__content-texts {
    display: flex;
    flex-direction: column;
  }
  .faq-section__description {
    max-width: var(--xxxxl, calc(var(--scale-text-px) * 540)) var(--n-xxxxl, var(--md, calc(var(--scale-text-px) * 320)) var(--n-md, none));
  }
  .faq-section__description a {
    color: var(--t-text);
    text-decoration-line: underline;
    text-decoration-color: var(--t-line-thin);
    text-underline-offset: 6px;
  }
  .faq-section__cards-wrapper {
    display: flex;
    justify-content: center;
    position: relative;
  }
  .faq-section__cards-wrapper-decoration {
    height: 100%;
    position: absolute;
    width: 100%;
    z-index: var(--md, -1) var(--n-md, 0);
  }
  .faq-section__cards {
    display: flex;
    flex-direction: column;
    gap: var(--spacing);
    position: relative;
    width: 100%;
    z-index: 1;
  }
  .faq-section__card {
    background: var(--t-background);
    width: var(--md, 31.5068493151vw) var(--n-md, auto);
  }
  .faq-section__card-list-item:not(:last-child) .faq-section__card-list-item-header {
    border-bottom: 1px solid var(--t-line);
    padding-bottom: var(--md, calc(var(--spacing) * 1.5)) var(--n-md, var(--spacing));
  }
  .faq-section__card-list-item-header {
    align-items: center;
    background-color: transparent;
    border: 0;
    color: var(--t-text);
    cursor: pointer;
    display: flex;
    font: inherit;
    justify-content: space-between;
    padding: calc(var(--spacing) * 0.75) 0;
    text-align: left;
    width: 100%;
  }
  .faq-section__card-list-item--active .faq-section__card-list-item-header-text-item,
  .faq-section__card-list-item--active .faq-section__card-list-item-header-icon {
    color: var(--t-text);
  }
  .faq-section__card-list-item--active .faq-section__card-list-item-header-icon {
    transform: rotate(180deg);
  }
  .faq-section__card-list-item--active .faq-section__card-list-item-header {
    border-color: var(--t-text);
  }
  .faq-section__card-list-item-header-icon {
    color: var(--t-small);
    margin-top: 2px;
    transition: transform 0.3s cubic-bezier(0.25, 0.74, 0.22, 0.99);
  }
  .faq-section__card-list-item-border {
    background: var(--t-text);
    border: 0;
    height: 1px;
  }
  .faq-section__card-list-item-internal-list {
    counter-reset: counter 0;
    display: flex;
    flex-direction: column;
    gap: var(--md, calc(var(--spacing) * 3)) var(--n-md, calc(var(--spacing) * 2));
    list-style-type: none;
    margin-block: 0;
    padding-left: 0;
  }
  .faq-section__card-list-item-internal-list--with-counter > li::before {
    content: counter(counter);
    counter-increment: counter 1;
    flex: 0 0 auto;
    width: var(--md, 2.0547945205vw) var(--n-md, calc(var(--scale-px) * 30));
  }
  .faq-section__card-list-item-internal-list-item {
    display: flex;
    gap: var(--md, var(--spacing)) var(--n-md, calc(var(--scale-px) * 10));
  }
  .faq-section__faq-step-header + .faq-section__faq-step-content {
    margin-top: calc(var(--scale-px) * 20);
  }
  .faq-section__faq-step-content {
    color: var(--t-small);
    display: flex;
    flex-direction: column;
    gap: var(--spacing);
  }
  .faq-section__faq-step-content :deep(ul),
  .faq-section__faq-step-content ul {
    display: flex;
    flex-direction: column;
    gap: var(--spacing);
    list-style-type: circle;
    padding-left: var(--spacing);
  }
  .faq-section__faq-step-content li {
    padding-left: var(--md, calc(var(--spacing) * 1.5)) var(--n-md, var(--spacing));
  }
  .faq-section__faq-step-content a {
    color: var(--t-small);
    text-decoration-line: underline;
    text-decoration-color: var(--t-line);
    text-underline-offset: 4px;
  }
}
</style>
