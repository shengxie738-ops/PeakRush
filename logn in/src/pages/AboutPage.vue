<script setup lang="ts">
/**
 * AboutPage — /about.
 *
 * Measured at 1376x772: containerScrollHeight 7651 · section 1 `.about-page`
 * 1376x1507 · `.text-page-title` 659x696 at x=698 (the title column is the LAST
 * one: `col--last:md`) · `.text-page-content` 659 wide at x=19 · section 2
 * `.about-team-card` 659x582, image 207x207, `.about-team-card__title` 433x90 at
 * 49.6402px (`.text-lead`) · section 3 `.about-partners` 1376x842 with
 * `.about-partners__title` at 221.921px Hardbop 700.
 * h1.sr-only "Our Story" → 250.148px Hardbop 700 (the visible word is a glyph SVG
 * that was never downloaded, so the text fallback carries the pending marker).
 *
 * Team overlay behaviour is real: `.about-team-card__more` flips
 * `.about-team-card--overlay` on its card, which the measured CSS uses to slide
 * the role/email lines up and fade the photo out.
 */
import { computed, ref } from 'vue';
import SiteFooter from '@/components/SiteFooter.vue';
import PageIcon from './PageIcon.vue';
import PageTitle from './PageTitle.vue';
import RichText from './RichText.vue';
import { displaySvg } from '@/content/home';
import { ABOUT_BLOCKS, ABOUT_MEDIA, ABOUT_PAGE, ABOUT_DECORATIONS, PARTNER_LOGOS, TEAM } from '@/content/subpages/about';

/** The captured "OUR STORY" word-mark, or '' when unavailable (PageTitle then shows text). */
const aboutWordmark = computed(() => displaySvg('about-title')?.html ?? '');

const overlayOpen = ref<Set<string>>(new Set());

function toggleOverlay(name: string): void {
  const next = new Set(overlayOpen.value);
  if (next.has(name)) next.delete(name);
  else next.add(name);
  overlayOpen.value = next;
}

/** Mobile rows split the logo set in two; the desktop row is one long loop. */
const mobileRowOne = PARTNER_LOGOS.available;
const mobileRowTwo = PARTNER_LOGOS.available;
</script>

<template>
  <!-- 1 · Our Story (ui-pink) -->
  <div class="ui-pink" data-section-id="about.story">
    <div class="section section--under-next">
      <div class="section__layer section__layer--sticky ui-pink ui-background">
        <div class="about-page row row--gx px-1 pt-promo-header">
          <div class="col col:12 col--6:md text-page-content pr-1:md pb-4 pb-6:md">
            <div v-for="(block, index) in ABOUT_BLOCKS" :key="block.title">
              <div class="row row--gx">
                <div class="col col--12 col--6:md pb-2 pb-0:md">
                  <p class="text-lead text-box-trim">{{ block.title }}</p>
                </div>
                <div class="col col--12 col--6:md">
                  <RichText class="about-page__body" :blocks="block.body" />
                </div>
              </div>
              <hr v-if="index < ABOUT_BLOCKS.length - 1" class="mt-3 mb-1 mt-4:md" />
            </div>
          </div>

          <div class="col col:12 col--6:md col--last:md text-page-title pb-1">
            <PageTitle
              is="h1"
              :title="ABOUT_PAGE.heading"
              :visual="aboutWordmark ? [] : ['Our Story']"
              text-class="text-h1"
              wrapper-class="about-page__title-wrapper"
            >
              <!-- Captured 8-path "OUR STORY" glyph set (viewBox 0 0 503 670), measured at
                   [849,76,508,676]. Extracted 2026-10-01 into displayHeadings.json as
                   `about-title`; previously this heading fell back to real text at the
                   text-h1 scale, which is the wrong face and the wrong box. -->
              <span
                v-if="aboutWordmark"
                class="is-hidden:sm-down"
                data-evidence="reference-svg-glyphs"
                aria-hidden="true"
                v-html="aboutWordmark"
              />
            </PageTitle>
            <div class="about-page-media">
              <div v-for="(star, index) in ABOUT_MEDIA.stars" :key="index" class="about-page-media__decoration">
                <img
                  :src="star"
                  :class="`about-page-media__decoration-icon about-page-media__decoration-icon-${index + 1} img-full ${index === 0 ? 'icon-shake' : 'icon-shake-reverse'}`"
                  alt=""
                />
              </div>
              <div class="about-page-media__video-preview-wrapper">
                <span
                  class="not-nuxt-link btn btn--primary btn--square btn--block btn--accent about-page-media__video-preview-play-btn ui-orange"
                  role="button"
                  tabindex="0"
                  aria-label="Play video"
                  title=""
                >
                  <span class="btn__content">
                    <span class="btn__text">
                      <PageIcon name="hover" extra-class="btn__hover-accent btn__hover-accent--text" />
                      <img v-if="ABOUT_MEDIA.playIcon" class="about-page-media__video-preview-play-icon img-full" :src="ABOUT_MEDIA.playIcon" alt="" />
                    </span>
                  </span>
                </span>
                <template v-if="ABOUT_MEDIA.previews.length">
                  <img
                    v-for="(preview, index) in ABOUT_MEDIA.previews"
                    :key="preview"
                    :src="preview"
                    :class="`about-page-media__video-preview-el about-page-media__video-preview-el-${index + 1} img-full`"
                    alt=""
                  />
                </template>
                <span
                  v-else
                  class="about-page-media__placeholder"
                  data-evidence="pending-T00-subpage"
                  aria-hidden="true"
                ></span>
              </div>
            </div>
            <hr class="is-hidden:md-up" />
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- 2 · Meet the Team (ui-blue) -->
  <div class="ui-blue" data-section-id="about.team">
    <div class="section section--under-next about-team-section">
      <div class="section__layer section__layer--sticky section__layer--full-height ui-background">
        <div class="row row--gx px-1">
          <div class="col col:12 col--6:md about-team-title pt-promo-header">
            <h2 class="text-h1 text-box-trim">Meet the<br />Team</h2>
            <hr class="is-hidden:md-up mt-4" />
          </div>

          <div class="col col:12 col--6:md about-team-content pt-1 pt-promo-header:md">
            <div
              v-for="member in TEAM"
              :key="member.name"
              :class="['about-team-card', overlayOpen.has(member.name) ? 'about-team-card--overlay' : '']"
            >
              <div class="about-team-card__layer-content row row--gx">
                <div class="col col--8 col--4:md offset--2 offset--4:md px-1 px-0:md about-team-card__image">
                  <img class="img-full" :src="member.photo" :alt="member.name" />
                </div>
                <div class="col col--10 col--8:md offset--1 offset--2:md about-team-card__content">
                  <h2 class="text-lead text-box-trim text-color-text about-team-card__title pl-1:md">{{ member.name }}</h2>
                  <a
                    v-if="member.email"
                    class="btn btn--link btn--block btn--accent text-card-base about-team-card__mail"
                    :href="`mailto:${member.email}`"
                    >{{ member.email }}</a
                  >
                </div>
                <p class="text-small text-color-small text-box-trim about-team-card__role">
                  <template v-for="(line, index) in member.role.split('\n')" :key="line">
                    <br v-if="index > 0" />{{ line }}
                  </template>
                </p>
                <p v-if="member.email" class="text-small text-color-small text-box-trim about-team-card__email is-hidden:sm-down">
                  {{ member.email }}
                </p>
                <button
                  class="not-nuxt-link btn btn--square btn--primary btn--accent about-team-card__more is-hidden:sm-down"
                  type="button"
                  :aria-expanded="overlayOpen.has(member.name) ? 'true' : 'false'"
                  :aria-label="member.name"
                  data-testid="team-more"
                  @click="toggleOverlay(member.name)"
                >
                  <span class="btn__content">
                    <span class="btn__text">
                      <PageIcon name="hover" extra-class="btn__hover-accent btn__hover-accent--text" />
                    </span>
                  </span>
                </button>
              </div>
              <div
                class="about-team-card__layer-overlay about-team-card__overlay"
                data-evidence="pending-T00-subpage"
                aria-hidden="true"
              ></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- 3 · Partners, Collaborators & Media (ui-green) -->
  <div class="ui-green" data-section-id="about.partners">
    <div class="section section--under-next about-partners-section">
      <div class="section__layer section__layer--sticky section__layer--full-height ui-background">
        <div class="sticky sticky--full-height pt-promo-header">
          <div class="about-partners">
            <div class="about-partners__header mb-8.25 mb-8:md px-1">
              <div class="about-partners__title-wrapper">
                <h2 class="about-partners__title text-h2-sm text-box-trim">{{ ABOUT_PAGE.partnersHeading }}</h2>
                <img class="about-partners__title-decoration img-full" :src="ABOUT_DECORATIONS.partnersHelix" alt="" />
              </div>
            </div>
            <hr class="mb-1 mx-1" />

            <div class="about-partners__carousel-rows mt-auto">
              <div class="about-partners__loop-carousel is-hidden:sm-down">
                <ul class="about-partners__loop-group about-partners__loop-group--desktop">
                  <li v-for="logo in PARTNER_LOGOS.available" :key="`d-${logo}`" class="about-partners__card">
                    <img class="img-full" :src="`${PARTNER_LOGOS.directory}${logo}`" :alt="logo.replace('.svg', '')" />
                  </li>
                </ul>
              </div>
              <div class="about-partners__loop-carousel is-hidden:md-up">
                <ul class="about-partners__loop-group about-partners__loop-group--row-1">
                  <li v-for="logo in mobileRowOne" :key="`r1-${logo}`" class="about-partners__card">
                    <img class="img-full" :src="`${PARTNER_LOGOS.directory}${logo}`" :alt="logo.replace('.svg', '')" />
                  </li>
                </ul>
              </div>
              <div class="about-partners__loop-carousel is-hidden:md-up">
                <ul class="about-partners__loop-group about-partners__loop-group--row-2">
                  <li v-for="logo in mobileRowTwo" :key="`r2-${logo}`" class="about-partners__card">
                    <img class="img-full" :src="`${PARTNER_LOGOS.directory}${logo}`" :alt="logo.replace('.svg', '')" />
                  </li>
                </ul>
              </div>

              <!-- The second half of the measured logo set (10 of 20 files) was never
                   downloaded into public/, so it is declared, not faked. -->
              <p class="about-partners__missing text-smaller text-color-small" data-evidence="pending-T00-subpage">
                Not captured locally: {{ PARTNER_LOGOS.missing.join(', ') }}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>

  <div class="ui-green footer-shell px-1 py-1">
    <div class="section-10">
      <SiteFooter />
    </div>
  </div>
</template>

<style>
@layer components {
  .text-page-content {
    position: relative;
  }
  .text-page-content::before {
    border-right: 1px solid var(--t-line);
    content: '';
    height: 100%;
    position: absolute;
    right: 0;
    top: 0;
  }
  .text-page-title {
    align-items: flex-end;
    display: flex;
    flex-direction: column;
    height: calc(100svh - var(--promo-header-height) - var(--spacing));
    justify-content: space-between;
    position: sticky;
    top: calc(var(--promo-header-height) + var(--spacing));
  }
  .about-page__title-wrapper {
    position: relative;
  }
  .about-page__title-wrapper .page-title__visual {
    font-size: var(--md, calc(var(--scale-text-rem) * 11)) var(--n-md, calc(var(--scale-text-rem) * 6));
    line-height: 1.02;
  }
  .about-page__body {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-small);
  }
  .about-page__body a {
    color: var(--t-text);
    text-decoration-line: underline;
    text-decoration-color: var(--t-line);
    text-underline-offset: 4px;
  }
  .about-page-media {
    aspect-ratio: var(--md, 700 / 680) var(--n-md, 350 / 270);
    height: var(--md, 18.6301vw) var(--n-md, 46.9231vw);
    left: var(--md, -10.8974vw) var(--n-md, 42.0513vw);
    position: relative;
    top: var(--md, 11.6667vw) var(--n-md, 7.4359vw);
    width: var(--md, 34.8718vw) var(--n-md, 39.7436vw);
    z-index: 1;
  }
  .about-page-media__decoration {
    position: absolute;
    z-index: 1;
  }
  .about-page-media__decoration-icon-1 {
    height: var(--md, 6.095890411vw) var(--n-md, 12.8205128205vw);
    width: var(--md, 3.8356164384vw) var(--n-md, 8.2051282051vw);
  }
  .about-page-media__decoration-icon-2 {
    height: var(--md, 3.4931506849vw) var(--n-md, 7.4358974359vw);
    width: var(--md, 2.1917808219vw) var(--n-md, 4.6153846154vw);
  }
  .about-page-media__video-preview-wrapper {
    height: 100%;
    transform: var(--md, translate(0, 0) rotate(-15.1deg)) var(--n-md, translate(0, 0) rotate(15.1deg));
    position: relative;
  }
  .about-page-media__video-preview-play-btn {
    height: var(--md, 4.1095890411vw) var(--n-md, calc(var(--scale-px) * 40));
    left: 50%;
    position: absolute;
    top: 50%;
    transform: var(--md, translate(-53%, -51%) rotate(15.1deg)) var(--n-md, translate(-54%, -57%) rotate(-15.1deg));
    width: var(--md, 4.1095890411vw) var(--n-md, calc(var(--scale-px) * 40));
    z-index: 1;
  }
  .about-page-media__video-preview-play-icon {
    height: var(--md, 1.095890411vw) var(--n-md, calc(var(--scale-px) * 16));
    width: var(--md, 0.6849315068vw) var(--n-md, calc(var(--scale-px) * 10));
  }
  .about-page-media__video-preview-el {
    height: 100%;
    object-fit: cover;
    position: absolute;
    width: 100%;
  }
  .about-page-media__placeholder {
    background: var(--t-avatar);
    display: block;
    height: 100%;
    width: 100%;
  }

  .about-team-title {
    height: var(--md, 100svh) var(--n-md, auto);
    position: var(--md, sticky) var(--n-md, relative);
    top: 0;
  }
  .about-team-title .text-h1 {
    font-size: var(--md, calc(var(--scale-text-rem) * 11)) var(--n-md, calc(var(--scale-text-rem) * 6));
    line-height: 1.02;
  }
  .about-team-content {
    position: relative;
  }
  .about-team-content::before {
    border-left: 1px solid var(--t-line);
    bottom: var(--spacing);
    content: '';
    display: var(--md, block) var(--n-md, none);
    left: calc(var(--grid-gx) * -1);
    position: absolute;
    top: calc(var(--promo-header-height) + var(--spacing));
  }
  .about-team-card {
    border-bottom: 1px solid var(--t-line);
    display: grid;
    grid-auto-rows: 1fr;
    grid-template: 'card-content' / 1fr;
    overflow: clip;
    position: relative;
  }
  .about-team-card:last-child {
    border-bottom: 0;
    margin-bottom: 0;
  }
  .about-team-card__layer-content,
  .about-team-card__layer-overlay {
    align-self: start;
    grid-area: card-content;
  }
  .about-team-card__layer-content {
    padding-bottom: var(--md, calc(var(--spacing) * 6.5)) var(--n-md, calc(var(--spacing) * 6));
    padding-top: var(--md, calc(var(--spacing) * 9.5)) var(--n-md, calc(var(--spacing) * 7));
  }
  .about-team-card__content {
    position: relative;
    transition: transform 0.4s cubic-bezier(0.55, 0, 0.1, 1);
    z-index: 2;
  }
  .about-team-card__title {
    margin-top: -0.45em;
  }
  .about-team-card__role {
    left: 0;
    position: absolute;
    top: var(--spacing);
    transition: transform 0.4s cubic-bezier(0.55, 0, 0.1, 1);
    width: 100%;
  }
  .about-team-card__email {
    position: absolute;
    right: 0;
    top: var(--spacing);
    transition: transform 0.4s cubic-bezier(0.55, 0, 0.1, 1);
  }
  .about-team-card__mail {
    color: var(--t-small);
  }
  .about-team-card__more {
    bottom: var(--spacing);
    position: absolute;
    right: 0;
  }
  .about-team-card__image {
    transition: transform 0.4s cubic-bezier(0.55, 0, 0.1, 1), opacity;
  }
  .about-team-card__overlay {
    opacity: 0;
    padding-top: var(--spacing);
    pointer-events: none;
    transition: opacity 0.4s cubic-bezier(0.55, 0, 0.1, 1);
    z-index: 1;
  }
  .about-team-card--overlay .about-team-card__email,
  .about-team-card--overlay .about-team-card__role {
    transform: translateY(calc(var(--spacing) * -1 - 2.5em));
  }
  .about-team-card--overlay .about-team-card__image {
    opacity: 0;
    transform: scale(0.5);
  }
  .about-team-card--overlay .about-team-card__content {
    transform: translate(calc(-25% - var(--spacing)), calc(var(--spacing) * 5.5));
  }
  .about-team-card--overlay .about-team-card__overlay {
    opacity: 1;
    pointer-events: auto;
  }

  .about-partners {
    display: flex;
    flex-direction: column;
    margin-bottom: var(--cookie-message-mobile-height, 0);
  }
  .about-partners__header {
    align-items: flex-start;
    display: flex;
    flex: 1 1 0;
  }
  .about-partners__title-wrapper {
    position: relative;
    width: 100%;
  }
  .about-partners__title {
    font-size: var(--md, calc(var(--scale-text-rem) * 8)) var(--n-md, calc(var(--scale-text-rem) * 4));
    line-height: 1.05;
  }
  .about-partners__title-decoration {
    aspect-ratio: var(--md, 630 / 561) var(--n-md, 312 / 277);
    left: 50%;
    pointer-events: none;
    position: absolute;
    top: var(--md, 10%) var(--n-md, auto);
    transform: translate(-50%);
    width: var(--md, 43.1506849315vw) var(--n-md, 80vw);
    z-index: -1;
  }
  .about-partners__carousel-rows {
    display: flex;
    flex-direction: column;
    gap: var(--md, calc(var(--scale-px) * 20)) var(--n-md, calc(var(--scale-px) * 10));
  }
  .about-partners__loop-carousel {
    display: flex;
    overflow: hidden;
    width: 100%;
  }
  .about-partners__loop-group {
    animation: about-partners-loop 60s linear infinite;
    display: grid;
    gap: var(--md, calc(var(--scale-px) * 20)) var(--n-md, calc(var(--scale-px) * 10));
    grid-auto-flow: column;
    list-style-type: none;
    margin: 0;
    padding-left: var(--md, calc(var(--scale-px) * 20)) var(--n-md, calc(var(--scale-px) * 10));
    will-change: transform;
  }
  .about-partners__loop-group--row-1 {
    animation-duration: 27s;
  }
  .about-partners__loop-group--row-2 {
    animation-duration: 30s;
  }
  .about-partners__card {
    aspect-ratio: var(--md, 1 / 0.73) var(--n-md, 1 / 0.7);
    background-color: var(--c-black);
    overflow: hidden;
    position: relative;
    width: var(--md, calc(var(--scale-px) * 220)) var(--n-md, 43.5897435897vw);
  }
  .about-partners__card img {
    height: 100%;
    object-fit: contain;
    padding: var(--spacing-tiny);
    width: 100%;
  }
  @keyframes about-partners-loop {
    to {
      transform: translateX(-50%);
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .about-partners__loop-group {
      animation: none;
    }
  }

  .footer-shell {
    margin-bottom: var(--cookie-message-height, 0);
  }
}
</style>
