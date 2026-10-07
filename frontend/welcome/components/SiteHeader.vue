<script setup lang="ts">
/**
 * SiteHeader.vue — the reference `PagePromoHeader` + `PagePromoMobileMenu`
 * (evidence/reference/raw/_nuxt/Bi84onXO.js). The DOM, class list and text order
 * are the measured ones from docs/DOM_CONTRACT.md ("Header (measured text order)"):
 *   FOLLOW. ART / One Practice. One Card · About Our Product Community Board
 *   Pricing FAQ · Login Join · plus the #menu anchor.
 *
 * The theme (and with it the colour of the fixed bar) is read from the
 * `data-page-header-theme` attribute each `<section>` carries, exactly as the
 * reference does with its `Yp()` helper: the active theme is the last section whose
 * top is still above the bottom of the viewport.
 */
import { computed, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue';
import { useRoute } from 'vue-router';
import BrushLink from './BrushLink.vue';
import AccessibleDialog from './AccessibleDialog.vue';
import { HEADER, EXTERNAL } from '@/content/home';

const props = withDefaults(
  defineProps<{
    theme?: string;
    border?: boolean | 'auto';
    background?: boolean;
    defaultExpanded?: boolean;
    hasLoadingState?: boolean;
    loading?: boolean;
  }>(),
  {
    theme: 'light',
    border: 'auto',
    background: true,
    defaultExpanded: false,
    hasLoadingState: false,
    loading: false,
  },
);

const route = useRoute();

const activeTheme = ref<string>(props.theme);
const previousTheme = ref<string>(props.theme);
const previousBackgroundStyle = shallowRef<Record<string, string>>({ transform: 'translateY(-100px)' });
const expanded = ref<boolean>(props.defaultExpanded);

/** `$a` theme → colour map from Bi84onXO.js, used for the theme-color meta tag. */
const THEME_COLORS: Record<string, string> = {
  light: '#FFFFFF',
  dark: '#000000',
  orange: '#F4793A',
  blue: '#8498AC',
  pink: '#C5939D',
  green: '#8E9487',
};

const metaTheme = computed(() => THEME_COLORS[activeTheme.value] ?? THEME_COLORS[props.theme]);

const rootClass = computed(() => {
  const parts = ['promo-header', 'px-1'];
  if (props.hasLoadingState) parts.push('promo--has-loading-state');
  if (!props.loading) parts.push('promo--loaded');
  if (props.border === 'auto') parts.push('promo-header--border-auto');
  if (props.border === true) parts.push('promo-header--border');
  if (expanded.value) parts.push('promo-header--expanded');
  parts.push('ui-' + activeTheme.value);
  if (props.background) parts.push('ui-background');
  return parts.join(' ');
});

const previousClass = computed(() => ['ui-' + previousTheme.value, 'ui-background', 'promo-header__previous-bg']);
const textSize = computed(() => (expanded.value ? 'smaller' : ''));

function isActive(to: string): boolean {
  return route.path === to;
}

/**
 * /signin and /signup render the reference's plain `.header`, not `.promo-header`:
 * the logo plus the *other* auth mode and nothing in between. Measured on the
 * frozen frames — V21 has "Join" at [1331,19] and no ink between x=640 and
 * x=1330 in the bar; V22 has "Login" at [1322,19].
 */
const authRoute = computed(() => route.name === 'signin' || route.name === 'signup');
const otherAuthMode = computed(() => (route.name === 'signin' ? HEADER.join : HEADER.login));

let frame = 0;
let sections: HTMLElement[] = [];

function measure(): void {
  sections = Array.from(
    document.querySelectorAll<HTMLElement>('[data-page-header-theme]'),
  ).filter((el) => !el.closest('.page-leave-to, .page-leave-active'));
  sync();
}

function sync(): void {
  const viewport = window.innerHeight;
  let current = props.theme;
  let previous = props.theme;
  let offset = -viewport;
  for (const el of sections) {
    const top = el.getBoundingClientRect().top;
    if (top < viewport) {
      previous = current;
      const attr = el.getAttribute('data-page-header-theme') ?? props.theme;
      current = attr;
      if (top > 0) offset = top - viewport;
    }
  }
  if (current !== activeTheme.value) activeTheme.value = current;
  if (previous !== previousTheme.value) previousTheme.value = previous;
  previousBackgroundStyle.value = { transform: `translateY(${offset}px)` };
  if (!props.defaultExpanded) expanded.value = scrollProgressTop() > 10;
}

function scrollProgressTop(): number {
  const area = document.querySelector<HTMLElement>('.scrollable__area');
  return area ? area.scrollTop : window.scrollY;
}

function onScroll(): void {
  if (frame) return;
  frame = window.requestAnimationFrame(() => {
    frame = 0;
    sync();
  });
}

onMounted(() => {
  measure();
  const area = document.querySelector<HTMLElement>('.scrollable__area') ?? window;
  area.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll);
  window.addEventListener('scroll', onScroll, { passive: true });
});

onBeforeUnmount(() => {
  if (frame) window.cancelAnimationFrame(frame);
  const area = document.querySelector<HTMLElement>('.scrollable__area') ?? window;
  area.removeEventListener('scroll', onScroll);
  window.removeEventListener('resize', onScroll);
  window.removeEventListener('scroll', onScroll);
});

/* CLONE-LOCAL: App.vue derives `theme` from the resolved route, and the router is
   not ready on the very first render, so `props.theme` (and with it `activeTheme`)
   can be initialised to the 'light' default while the page mounts. The reference's
   bar is orange on `/` (hero-geometry.json -> header.bg = rgb(244,121,58)), so the
   bar re-reads the section themes whenever the incoming route theme changes. */
watch(
  () => props.theme,
  (value) => {
    activeTheme.value = value;
    previousTheme.value = value;
    measure();
  },
);

/* Same first-render race for `defaultExpanded`: the home route sets it, and it
   is what selects `text-size="smaller"` on the seven nav links (the measured
   12.6534px / 9px-tall row in hero-geometry.json -> header.linkStyle). */
watch(
  () => props.defaultExpanded,
  (value) => {
    expanded.value = value;
  },
);
</script>

<template>
  <header :class="rootClass">
    <div :class="previousClass" :style="previousBackgroundStyle" />
    <div class="row row--gx row--middle promo-header__row">
      <div class="col col--8 col--5:md col--6:xl promo-header__logo">
        <BrushLink
          variant="link block accent"
          :text-size="textSize"
          :title="HEADER.logo"
          to="/"
        />
        <p class="promo-header__logo-text text-smaller text-color-small text-box-trim">
          {{ HEADER.tagline }}
        </p>
      </div>

      <div v-if="!authRoute" class="promo-header__desktop-links col col--5 col--4:xl is-hidden:sm-down">
        <BrushLink
          v-for="item in HEADER.nav"
          :key="item.to"
          class="promo-header__animated-button"
          variant="link block accent"
          :text-size="textSize"
          :title="item.label"
          :to="item.to"
          :active="isActive(item.to)"
        />
      </div>

      <div
        v-if="authRoute"
        class="col col--7:md col--6:xl is-hidden:sm-down text-right promo-header__content-right promo-header__content-right--auth"
      >
        <div class="promo-header__desktop-links">
          <BrushLink
            class="promo-header__animated-button"
            variant="link block accent"
            :text-size="textSize"
            :title="otherAuthMode.label"
            :to="otherAuthMode.to"
            :active="isActive(otherAuthMode.to)"
          />
        </div>
      </div>

      <div v-if="!authRoute" class="col col--2 is-hidden:sm-down text-right promo-header__content-right">
        <div class="promo-header__desktop-links">
          <BrushLink
            class="promo-header__animated-button"
            variant="link block accent"
            :text-size="textSize"
            :title="HEADER.login.label"
            :to="HEADER.login.to"
            :active="isActive(HEADER.login.to)"
          />
          <BrushLink
            class="promo-header__animated-button"
            variant="link block accent"
            :text-size="textSize"
            :title="HEADER.join.label"
            :to="HEADER.join.to"
            :active="isActive(HEADER.join.to)"
          />
        </div>
      </div>

      <div class="col col--4 is-hidden:md-up text-right promo-header__content-right">
        <BrushLink :href="HEADER.menuAnchor" variant="link block accent" icon="menu" :aria-label="HEADER.menuLabel" />
      </div>
    </div>

    <!-- #menu — the reference PagePromoMobileMenu, a Modal(id="menu", theme="orange").
         The trigger above is is-hidden:md-up, so on desktop it is never reachable,
         but the markup and its route targets stay in the DOM. -->
    <AccessibleDialog id="menu" variant="menu" theme="orange" :title="HEADER.logo">
      <template #header>
        <BrushLink variant="link block accent" :title="HEADER.logo" to="/" class="mobile-menu-logo" />
      </template>
      <div class="mobile-menu">
        <div class="mobile-menu__stub" />
        <div class="mobile-menu__list">
          <ul class="px-1">
            <li v-for="item in HEADER.nav" :key="item.to">
              <BrushLink variant="link" text-size="h5" :title="item.label" :to="item.to" />
            </li>
          </ul>
          <hr class="mobile-menu__list-line hr-thin" />
          <div class="mobile-menu__list-auth px-1">
            <img
              class="mobile-menu__list-decoration"
              src="/assets/decor/menu-decoration.png"
              width="260"
              height="262"
              alt=""
              data-evidence="pending-T01-assets"
            />
            <BrushLink variant="link" text-size="h5" :title="HEADER.login.label" :to="HEADER.login.to" />
            <BrushLink variant="link" text-size="h5" :title="HEADER.join.label" :to="HEADER.join.to" />
          </div>
        </div>
        <div class="mobile-menu__sub-links mt-auto px-1 py-1">
          <BrushLink variant="link" :title="'Brand Kit'" :href="EXTERNAL.brandKit" external />
        </div>
      </div>
    </AccessibleDialog>

    <!-- theme-color meta, as the reference sets it from the active section theme -->
    <Teleport to="head">
      <meta name="theme-color" :content="metaTheme" />
    </Teleport>
  </header>
</template>
