<script setup lang="ts">
/**
 * SiteFooter.vue — the reference footer block.
 *
 * In the reference the footer is not a standalone layout component: it is the
 * bottom of the Join Us section (`Landing10JoinUs`,
 * evidence/reference/raw/_nuxt/CCJzzdh0.js), emitted as
 *   <footer class="section-10__footer text-smaller row row--gx row--stretch"> … </footer>
 * inside <section class="ui-orange wrapper-section-10" data-page-header-theme="orange">.
 * That measured class list, text order and nesting are reproduced here; `shell`
 * adds the surrounding .section / .section__layer / .sticky chain for pages that
 * need the whole block, so the footer markup itself is written exactly once.
 *
 * Social row = `SocialNetworks` (XDSQCzXF.js): 5 icon buttons, variant
 * "primary square block accent", size/text-size "smallish".
 */
import { computed, h, type Component, type VNode } from 'vue';
import BrushLink from './BrushLink.vue';
import { FOOTER, EXTERNAL, JOIN } from '@/content/home';

/**
 * The reference footer credit carries the Vide Infra mark as an inline <svg> whose class
 * differs per breakpoint (CCJzzdh0.js). The mark path data was not part of the
 * captured chunks available to this clone, so the placeholder keeps the reference
 * class contract and the link target; the artwork itself is tracked as an asset gap.
 */
function VideinfraIcon(className: string): Component {
  return {
    render(): VNode {
      return h(
        'svg',
        { class: className, viewBox: '0 0 24 24', width: '24', height: '24', 'aria-hidden': 'true', focusable: 'false' },
        [h('rect', { x: '2', y: '2', width: '20', height: '20', fill: 'none', stroke: 'currentColor', 'stroke-width': '1.5' })],
      );
    },
  };
}

const props = withDefaults(
  defineProps<{
    /** Wrap the footer in the reference .wrapper-section-10 shell. */
    shell?: boolean;
    /** Description shown next to the Join CTA inside the shell. */
    description?: string;
    /** Reference pageVariant, drives the CTA aria-label. */
    pageVariant?: string;
  }>(),
  { shell: false, description: JOIN.ariaLabel, pageVariant: 'other' },
);

/** The reference renders the year from `new Date().getFullYear()`. */
const year = new Date().getFullYear();

/**
 * Both wrappers are functional components, so Vue passes `(props, context)` and the default slot
 * lives on `context.slots`. Reading `slots.default` off the second parameter (an earlier revision
 * did) silently resolved `undefined`, which rendered zero `<footer>` elements on all 11 routes that
 * use this component while still painting the 772px sticky shell around them — a hole no gate caught
 * because the shell's height never changed.
 */
type FunctionalSlots = { slots: { default?: () => VNode[] } };

/** passthrough fragment used when no shell is requested */
const Bare = (_p: unknown, ctx: FunctionalSlots): VNode[] => (ctx.slots.default ? ctx.slots.default() : []);

/** the reference .wrapper-section-10 > Section > SectionLayer > Sticky > .section-10 chain */
function Shell(_p: unknown, ctx: FunctionalSlots): VNode {
  return h(
    'section',
    { class: 'ui-orange wrapper-section-10', 'data-page-header-theme': 'orange' },
    [
      h('div', { class: 'section' }, [
        h('div', { class: 'section__layer section__layer--sticky section__layer--full-height ui-background' }, [
          h('div', { class: 'sticky sticky--sticky sticky--full-height px-1 pb-1 pt-promo-header' }, [
            h('div', { class: 'section-10' }, [
              h('p', { class: 'section-10__description text-box-trim col col-12' }, props.description),
              ...(ctx.slots.default ? ctx.slots.default() : []),
            ]),
          ]),
        ]),
      ]),
    ],
  );
}

const wrapper = computed<Component>(() => (props.shell ? (Shell as unknown as Component) : (Bare as unknown as Component)));
</script>

<template>
  <component :is="wrapper">
    <footer class="section-10__footer text-smaller row row--gx row--stretch">
      <div class="section-10__footer-side col col--12 col--6:md col--last:md mb-1 mb-0:md">
        <nav aria-label="Footer navigation">
          <ul class="section-10__footer-nav">
            <li v-for="item in FOOTER.nav" :key="item.label" class="text-box-trim">
              <BrushLink
                class="section-10__footer-link"
                variant="link block text-smaller accent"
                :title="item.label"
                :to="'to' in item && item.to ? item.to : undefined"
                :href="'href' in item && item.href ? item.href : undefined"
                external
              />
            </li>
          </ul>
        </nav>

        <div class="group group--smaller group--v-center is-hidden:sm-down">
          <BrushLink
            :href="EXTERNAL.videinfra"
            external
            variant="link block accent"
            text-size="smaller"
            :attr-title="FOOTER.madeByTitle"
            class="section-10__made-by"
            >
{{ FOOTER.madeBy }}
</BrushLink
          >
          <component
            :is="VideinfraIcon('section-10__made-by-icon is-hidden:sm-down')"
          />
        </div>

        <div class="text-right is-hidden:md-up">
          <p class="text-box-trim is-hidden:md-up">{{ year }} {{ FOOTER.copyright }}</p>
          <BrushLink
            variant="link accent"
            text-size="smaller"
            :href="EXTERNAL.email"
            :title="FOOTER.email"
            class="mt-0.25"
          />
        </div>
      </div>

      <div class="section-10__footer-side-left col col--12 col--6:md mt-2 mt-0:md is-hidden:sm-down">
        <p class="text-box-trim">{{ year }} {{ FOOTER.copyright }}</p>
        <BrushLink variant="link accent" text-size="smaller" :href="EXTERNAL.email" :title="FOOTER.email" />
        <div class="is-hidden:sm-down mt-auto">
          <div class="social-networks mt-auto social-networks--smaller">
            <BrushLink
              v-for="item in FOOTER.social"
              :key="item.icon"
              variant="primary square block accent"
              text-size="smallish"
              size="smallish"
              :href="item.href"
              external
              :icon="item.icon"
              :aria-label="item.label"
            />
          </div>
        </div>
      </div>

      <div class="group group--smaller group--v-center mt-1 is-hidden:md-up">
        <component :is="VideinfraIcon('section-10__made-by-icon is-hidden:md-up')" />
        <BrushLink
          :href="EXTERNAL.videinfra"
          external
          variant="link block accent"
          text-size="smaller"
          :attr-title="FOOTER.madeByTitle"
          class="section-10__made-by"
          >
{{ FOOTER.madeBy }}
</BrushLink
        >
        <component :is="VideinfraIcon('section-10__made-by-icon is-hidden:sm-down')" />
      </div>

      <div class="is-hidden:md-up mt-1.5">
        <div class="social-networks mt-auto social-networks--smaller">
          <BrushLink
            v-for="item in FOOTER.social"
            :key="item.icon"
            variant="primary square block accent"
            text-size="smallish"
            size="smallish"
            :href="item.href"
            external
            :icon="item.icon"
            :aria-label="item.label"
          />
        </div>
      </div>
    </footer>
  </component>
</template>
