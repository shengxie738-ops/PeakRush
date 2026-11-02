<script setup lang="ts">
import { computed } from 'vue';
import PromoFooter from '@/components/PromoFooter.vue';
import { displaySvg } from '@/content/home';
import { GIFT_CARD } from '@/content/subpages/giftCard';
import PageCta from './PageCta.vue';

const giftCardWordmark = computed(() => displaySvg('gift-card-title')?.html ?? '');
</script>

<template>
  <article class="ui-orange gift-card-page" data-section-id="gift-card" data-page-header-theme="orange">
    <div class="section gift-card-hero row row--gx px-1 pt-promo-header">
      <div class="gift-card-section__content col col-12 col--6:md">
        <div class="gift-card-section__title text-h2 text-box-trim pr-1">
          <div class="title gift-card-hero__title">
            <h1 class="sr-only">{{ GIFT_CARD.titleText }}</h1>
            <div class="title-children-wrapper">
              <span v-if="giftCardWordmark" class="is-hidden:sm-down" aria-hidden="true" v-html="giftCardWordmark" />
              <span :class="['page-title__visual text-h1', giftCardWordmark ? 'is-hidden:md-up' : '']" aria-hidden="true">{{ GIFT_CARD.titleText }}</span>
            </div>
          </div>
        </div>
        <img class="gift-card-hero__decoration icon-shake" :src="GIFT_CARD.titleDecoration" alt="" aria-hidden="true" />
        <PageCta variant="primary accent large" extra-class="gift-card-hero__cta" :label="GIFT_CARD.ctaText" href="/app/" />
      </div>
      <div class="col col-12 col--6:md gift-card-hero__collection">
        <img :src="GIFT_CARD.background" alt="PeakRush 数码好物清单：无线耳机、智能手表与便携相机" />
      </div>
    </div>

    <section class="section gift-card-video">
      <h2 class="text-h4">
        <span v-for="(line, i) in GIFT_CARD.video.lines" :key="i">{{ line }} </span>
      </h2>
      <figure class="gift-card-video__preview">
        <img :src="GIFT_CARD.video.preview" :alt="GIFT_CARD.video.lines.join('，')" />
        <PageCta variant="primary square" extra-class="gift-card-video__play" href="/app/" aria-label="进入商城发现好物">
          <img :src="GIFT_CARD.video.playIcon" alt="" aria-hidden="true" />
        </PageCta>
      </figure>
      <p>找到喜欢的商品，再查看当前抢购场次。</p>
    </section>

    <section class="section gift-card-pitch ui-light">
      <p class="gift-card-pitch__lead text-h4">
        {{ GIFT_CARD.pitch }} <u>{{ GIFT_CARD.pitchUnderlined }}</u> {{ GIFT_CARD.pitchTail }}
      </p>
      <p>{{ GIFT_CARD.body }}</p>
      <h3 class="text-lead">{{ GIFT_CARD.unlocksTitle }}</h3>
      <ul class="gift-card-unlocks">
        <li v-for="(item, i) in GIFT_CARD.unlocks" :key="i">{{ item }}</li>
      </ul>
      <p>{{ GIFT_CARD.closing }}</p>
      <p>{{ GIFT_CARD.afterPurchase }}</p>
      <PageCta variant="primary accent" :label="GIFT_CARD.ctaText" href="/app/" />
    </section>

    <section class="section gift-card-media">
      <h3 class="text-h4">{{ GIFT_CARD.mediaTitle }}</h3>
      <ul class="gift-card-media__logos">
        <li v-for="(product, index) in GIFT_CARD.partners" :key="product">
          <a href="/app/">
            <img :src="GIFT_CARD.partnersDirectory + product" :alt="GIFT_CARD.partnerLabels[index]" />
            <span>{{ GIFT_CARD.partnerLabels[index] }} →</span>
          </a>
        </li>
      </ul>
    </section>

    <PromoFooter theme="ui-orange" />
  </article>
</template>

<style scoped>
.gift-card-hero { display: flex; flex-wrap: wrap; min-height: 100svh; padding-bottom: var(--spacing); align-items: stretch; }
.gift-card-page .gift-card-section__content { display: flex; flex-direction: column; position: relative; height: auto; gap: calc(var(--spacing) * 2); }
.gift-card-section__title .title { padding-right: calc(var(--spacing) / 2); }
.gift-card-hero__decoration { width: min(36%, 190px); margin: auto; }
.gift-card-hero__cta { align-self: flex-start; margin-top: auto; }
.gift-card-hero__collection { display: flex; justify-content: center; }
.gift-card-hero__collection > img { display: block; width: 100%; max-height: calc(100svh - var(--spacing-promo-header) - var(--spacing)); object-fit: contain; }
.gift-card-video, .gift-card-pitch, .gift-card-media { padding: calc(var(--spacing) * 3) var(--spacing); display: grid; gap: calc(var(--spacing) * 1.5); }
.gift-card-video__preview { position: relative; margin: 0; }
.gift-card-video__preview > img { display: block; width: 100%; max-height: 70svh; object-fit: cover; }
.gift-card-video__play { position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); }
.gift-card-video__play img { width: 28px; height: 28px; object-fit: contain; }
.gift-card-pitch > p { max-width: 55em; line-height: 1.7; }
.gift-card-pitch > .gift-card-pitch__lead { line-height: 1.3; }
.gift-card-unlocks { margin: 0; padding-left: 1.25em; line-height: 1.9; }
.gift-card-pitch > .btn { justify-self: start; }
.gift-card-media__logos { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: var(--spacing); list-style: none; padding: 0; margin: 0; }
.gift-card-media__logos a { display: grid; gap: var(--spacing); }
.gift-card-media__logos img { width: 100%; aspect-ratio: 1; object-fit: cover; }
.gift-card-media__logos span { font-size: 1.2em; }
@media (max-width: 767px) {
  .gift-card-hero { gap: calc(var(--spacing) * 2); }
  .gift-card-hero__collection > img { max-height: 65svh; }
  .gift-card-media__logos { grid-template-columns: 1fr; }
  .gift-card-hero__decoration { width: 90px; margin: var(--spacing) auto; }
}
</style>
