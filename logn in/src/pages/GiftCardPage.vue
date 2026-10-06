<script setup lang="ts">
/**
 * GiftCardPage — the public presentation of the gift card. The buy action stops at
 * a local echo: no payment, no network, no account (plan §3.3, §13.2).
 *
 * Rebound from the old placeholder to src/content/subpages/giftCard.ts, which holds
 * the text lifted from the reference's server-rendered HTML.
 */
import { ref, computed } from 'vue';
import PromoFooter from '@/components/PromoFooter.vue';
import { displaySvg } from '@/content/home';
import { GIFT_CARD, GIFT_CARD_FIELDS, GIFT_CARD_DEMO_NOTICE } from '@/content/subpages/giftCard';

/**
 * The reference paints "GIFT CARD" as an 8-path word-mark (viewBox 0 0 667 383) at
 * [24, 73, 631, 362] with the accessible name on a separate sr-only heading. Captured
 * 2026-10-01 into displayHeadings.json as `gift-card-title`; this page previously used a
 * visible `text-card-h1` (38.9px) instead, which is why the hero read as the wrong section.
 */
const giftCardWordmark = computed(() => displaySvg('gift-card-title')?.html ?? '');

const acknowledged = ref(false);
const fields = ref<Record<string, string>>({});
</script>

<template>
  <article class="ui-orange gift-card-page" data-section-id="gift-card" data-page-header-theme="orange">
    <div class="section gift-card-hero row row--gx px-1 pt-promo-header" :style="{ backgroundImage: `url(${GIFT_CARD.background})` }">
      <!-- Measured chain: .gift-card-section__content (col, 659px) > .gift-card-section__title
           .text-h2 (640px) > .title (631px) > svg[viewBox 0 0 667 383] at [24,73,631,362].
           The 631px is produced by the 6-column grid, so the wrapper has to be the grid —
           putting .title directly in a full-bleed hero makes the mark 1376px wide. -->
      <div class="gift-card-section__content col col-12 col--6:md">
        <div class="gift-card-section__title text-h2 text-box-trim pr-1">
          <div class="title gift-card-hero__title">
            <h1 class="sr-only">{{ GIFT_CARD.titleText }}</h1>
            <div class="title-children-wrapper">
              <span v-if="giftCardWordmark" class="is-hidden:sm-down" data-evidence="reference-svg-glyphs" aria-hidden="true" v-html="giftCardWordmark" />
              <span v-else class="page-title__visual text-h1" data-evidence="pending-T00-subpage" aria-hidden="true">{{ GIFT_CARD.titleText }}</span>
            </div>
          </div>
        </div>
        <img class="gift-card-hero__decoration" :src="GIFT_CARD.titleDecoration" alt="" aria-hidden="true" />
        <button class="btn btn--primary" type="button" @click="acknowledged = true">{{ GIFT_CARD.ctaText }}</button>
      </div>
    </div>

    <section class="section gift-card-video">
      <h2>
        <span v-for="(line, i) in GIFT_CARD.video.lines" :key="i">{{ line }} </span>
      </h2>
      <figure class="gift-card-video__preview">
        <img :src="GIFT_CARD.video.preview" :alt="GIFT_CARD.video.lines.join(' ')" />
        <img class="gift-card-video__play" :src="GIFT_CARD.video.playIcon" alt="" aria-hidden="true" />
      </figure>
      <p v-if="!GIFT_CARD.video.playable" class="clone-local-note">
        The reference video source was not captured; the poster is shown and playback is disabled.
      </p>
    </section>

    <section class="section gift-card-pitch">
      <p class="gift-card-pitch__lead">
        {{ GIFT_CARD.pitch }} <u>{{ GIFT_CARD.pitchUnderlined }}</u> {{ GIFT_CARD.pitchTail }}
      </p>
      <p>{{ GIFT_CARD.body }}</p>
      <h3>{{ GIFT_CARD.unlocksTitle }}</h3>
      <ul class="gift-card-unlocks">
        <li v-for="(item, i) in GIFT_CARD.unlocks" :key="i">{{ item }}</li>
      </ul>
      <p>{{ GIFT_CARD.closing }}</p>
      <p>{{ GIFT_CARD.afterPurchase }}</p>
    </section>

    <section class="section gift-card-form" v-if="acknowledged">
      <h3>{{ GIFT_CARD.ctaText }}</h3>
      <p class="demo-notice" role="note">{{ GIFT_CARD_DEMO_NOTICE }}</p>
      <label v-for="f in GIFT_CARD_FIELDS" :key="f.name" class="gift-card-form__field">
        <span>{{ f.label }}</span>
        <input v-model="fields[f.name]" :type="f.type ?? 'text'" :name="f.name" />
      </label>
      <p class="gift-card-form__echo">Demo only — nothing was submitted, charged or stored.</p>
    </section>

    <section class="section gift-card-media">
      <h3>{{ GIFT_CARD.mediaTitle }}</h3>
      <ul class="gift-card-media__logos">
        <li v-for="p in GIFT_CARD.partners" :key="p">
          <img :src="'/assets/subpages/gift-card/' + p" :alt="p.replace(/\.[a-z]+$/, '')" />
        </li>
      </ul>
    </section>

    <!-- DIFF-015: /gift-card carries the same promo footer /pricing does
         (ui-orange, measured box [0,4097.94,1376,185.21] on the reference). -->
    <PromoFooter theme="ui-orange" />
  </article>
</template>

<style>
/* CLONE-LOCAL: the reference's .gift-card-section__content is not defined in any
   captured stylesheet chunk, so it is declared here from measurement.
   MEASURED (1376x772 @ dpr 1.5): display:flex, box [19,76,659,676].
   DERIVED: flex-direction:column. It was not read directly; it is the only axis
   consistent with the measured column height (676px) exceeding its word-mark child
   (362px) while sharing the same x and width. If a future capture reads the real
   value and it disagrees, trust the capture and delete this line. */
.gift-card-section__content {
  display: flex;
  flex-direction: column;
}
</style>

<style>
/* CLONE-LOCAL, measured: .gift-card-section__title is 640.229px but its .title child is
   630.688px — a 9.541px inset, exactly var(--spacing)/2. `pr-1` supplied the outer
   19.104px; this supplies the inner half so the word-mark lands on the reference's
   631x362 instead of 640x368. */
.gift-card-section__title .title {
  padding-right: calc(var(--spacing) / 2);
}
</style>
