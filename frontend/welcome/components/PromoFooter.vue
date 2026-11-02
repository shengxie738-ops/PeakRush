<script setup lang="ts">
/**
 * PromoFooter.vue — `footer.promo-footer`, the compact per-route footer the
 * reference puts at the bottom of /pricing and /gift-card (DIFF-015).
 *
 * The markup below is the literal `footer.outerHTML` of the live route
 * (evidence/reference/raw/pricing-promo-footer.html) and the boxes are
 * evidence/reference/raw/pricing-promo-footer-boxtree.json, captured at
 * 1376x772 dpr1.5 with `body.cookie-message-active`. Only two things are
 * substituted, both deliberate and clone-wide:
 *   - `<use href>` points at the local sprite fragment (`#hover`) instead of
 *     `https://follow.art/_nuxt/icons.g7tMF2ID.svg#hover` — the clone makes no
 *     external request (App.vue mounts ICON_SPRITE once).
 *   - the captured `<!---->` placeholders (the reference Button's empty badge /
 *     icon slots) are dropped; comment nodes carry no box, no class and no text.
 *
 * Every `class` attribute is written as ONE static string in the reference's own
 * token order (`btn__hover-accent btn__hover-accent--text icon icon-hover`), so
 * nothing depends on how Vue merges `class` with `v-bind`/`:class`.
 *
 * DOM order is NOT visual order: `.col--first:md` (order:-1, layout.css) moves
 * the `div.group` column to the left of the links column, so the captured order
 * (links, group, author, mobile socials) is kept verbatim.
 *
 * Internal links are `<RouterLink custom>` + our own `<a>`: the reference marks
 * them `not-nuxt-link` and pushes the route on click, which means it never
 * stamps `router-link-active` into the class list. Rendering the anchor itself
 * keeps the captured class strings identical on every route.
 */
import { computed } from 'vue';
import { RouterLink } from 'vue-router';
import { PROMO_FOOTER } from '@/content/subpages/promoFooter';

const props = withDefaults(
  defineProps<{
    /** Route theme class appended after `ui-background` (`ui-orange`, `ui-green`, …). */
    theme?: string;
  }>(),
  { theme: 'ui-orange' },
);

/** The reference renders `new Date().getFullYear()`, not a literal year. */
const year = new Date().getFullYear();

const footerClass = computed(
  () => `promo-footer px-1 py-1 footer-padding ui-background ${props.theme}`,
);
</script>

<template>
  <footer :class="footerClass">
    <hr class="mb-1" />
    <div class="row row--gx row--stretch">
      <div class="row row--gx col col--12 col--3:md">
        <div class="col col--6 col--12:md footer-links pb-1 pb-0:md">
          <template v-for="item in PROMO_FOOTER.nav" :key="item.label">
            <RouterLink v-if="item.to" :to="item.to" custom v-slot="{ href, navigate }">
              <a
                class="not-nuxt-link btn btn--link btn--block btn--accent btn--text-smaller"
                :href="href"
                tabindex="0"
                title=""
                @click="navigate"
              ><span class="btn__content"><span class="btn__text"><svg
                    class="btn__hover-accent btn__hover-accent--text icon icon-hover"
                    role="presentation"
                    width="173px"
                    height="22px"
                    viewBox="0 0 173 22"
                    preserveAspectRatio="none"
                    style="--icon-width: 173; --icon-height: 22;"
                  ><use href="#hover" /></svg>{{ ' ' + item.label + ' ' }}</span></span></a>
            </RouterLink>
            <a
              v-else
              class="not-nuxt-link btn btn--link btn--block btn--accent btn--text-smaller"
              :href="item.href"
              tabindex="0"
              :target="item.external ? '_blank' : undefined"
              :rel="item.external ? 'noopener noreferrer' : undefined"
              title=""
            ><span class="btn__content"><span class="btn__text"><svg
                  class="btn__hover-accent btn__hover-accent--text icon icon-hover"
                  role="presentation"
                  width="173px"
                  height="22px"
                  viewBox="0 0 173 22"
                  preserveAspectRatio="none"
                  style="--icon-width: 173; --icon-height: 22;"
                ><use href="#hover" /></svg>{{ ' ' + item.label + ' ' }}</span></span></a>
          </template>
        </div>

        <div class="footer-copyright col col--6 is-hidden:md-up text-right">
          <p class="text-smaller text-box-trim text-right">{{ year + ' ' + PROMO_FOOTER.copyright + ' ' }}</p>
          <a
            class="not-nuxt-link btn btn--link btn--accent btn--text-smaller mt-0.25"
            :href="PROMO_FOOTER.emailHref"
            tabindex="0"
            title=""
          ><span class="btn__content"><span class="btn__text"><svg
                class="btn__hover-accent btn__hover-accent--text icon icon-hover"
                role="presentation"
                width="173px"
                height="22px"
                viewBox="0 0 173 22"
                preserveAspectRatio="none"
                style="--icon-width: 173; --icon-height: 22;"
              ><use href="#hover" /></svg><span class="btn__text-text">{{ PROMO_FOOTER.email }}</span></span></span></a>
        </div>
      </div>

      <div class="group col col--6 col--first:md">
        <div class="footer-side-left">
          <p class="footer-copyright text-smaller text-box-trim is-hidden:sm-down">{{ year + ' ' + PROMO_FOOTER.copyright + ' ' }}</p>
          <a
            class="not-nuxt-link btn btn--link btn--accent btn--text-smaller is-hidden:sm-down"
            :href="PROMO_FOOTER.emailHref"
            tabindex="0"
            title=""
          ><span class="btn__content"><span class="btn__text"><svg
                class="btn__hover-accent btn__hover-accent--text icon icon-hover"
                role="presentation"
                width="173px"
                height="22px"
                viewBox="0 0 173 22"
                preserveAspectRatio="none"
                style="--icon-width: 173; --icon-height: 22;"
              ><use href="#hover" /></svg><span class="btn__text-text">{{ PROMO_FOOTER.email }}</span></span></span></a>
          <div v-if="PROMO_FOOTER.social.length" class="is-hidden:sm-down mt-auto">
            <div class="social-networks mt-auto social-networks--">
              <a
                v-for="item in PROMO_FOOTER.social"
                :key="item.icon"
                class="not-nuxt-link btn btn--primary btn--square btn--block btn--accent btn--smallish btn--text-smallish"
                :href="item.href"
                tabindex="0"
                :aria-label="item.label"
                title=""
              ><svg
                  class="btn__hover-accent icon icon-hover"
                  role="presentation"
                  width="173px"
                  height="22px"
                  viewBox="0 0 173 22"
                  preserveAspectRatio="none"
                  style="--icon-width: 173; --icon-height: 22;"
                ><use href="#hover" /></svg><span class="btn__content"><svg
                    :class="`btn__icon icon icon-${item.icon}`"
                    role="presentation"
                    width="30px"
                    height="30px"
                    viewBox="0 0 30 30"
                    style="--icon-width: 30; --icon-height: 30;"
                  ><use :href="`#${item.icon}`" /></svg></span></a>
            </div>
          </div>
        </div>
      </div>

      <div class="col col--12 col--3:md mt-1 mt-0:md text-right footer-author">
        <a
          class="not-nuxt-link btn btn--link btn--block btn--accent btn--text-smaller"
          :href="PROMO_FOOTER.authorHref"
          tabindex="0"
          :title="PROMO_FOOTER.authorTitle"
        ><span class="btn__content"><span class="btn__text"><svg
              class="btn__hover-accent btn__hover-accent--text icon icon-hover"
              role="presentation"
              width="173px"
              height="22px"
              viewBox="0 0 173 22"
              preserveAspectRatio="none"
              style="--icon-width: 173; --icon-height: 22;"
            ><use href="#hover" /></svg>{{ ' ' + PROMO_FOOTER.author + ' ' }}</span></span></a>
      </div>

      <div v-if="PROMO_FOOTER.social.length" class="is-hidden:md-up mt-1.5">
        <div class="social-networks mt-auto social-networks--">
          <a
            v-for="item in PROMO_FOOTER.social"
            :key="item.icon"
            class="not-nuxt-link btn btn--primary btn--square btn--block btn--accent btn--smallish btn--text-smallish"
            :href="item.href"
            tabindex="0"
            :aria-label="item.label"
            title=""
          ><svg
              class="btn__hover-accent icon icon-hover"
              role="presentation"
              width="173px"
              height="22px"
              viewBox="0 0 173 22"
              preserveAspectRatio="none"
              style="--icon-width: 173; --icon-height: 22;"
            ><use href="#hover" /></svg><span class="btn__content"><svg
                :class="`btn__icon icon icon-${item.icon}`"
                role="presentation"
                width="30px"
                height="30px"
                viewBox="0 0 30 30"
                style="--icon-width: 30; --icon-height: 30;"
              ><use :href="`#${item.icon}`" /></svg></span></a>
        </div>
      </div>
    </div>
  </footer>
</template>
