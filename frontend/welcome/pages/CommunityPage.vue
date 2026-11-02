<script setup lang="ts">
import { computed, ref } from "vue";
import { RouterLink } from "vue-router";
import EditorialLayout from "@/components/EditorialLayout.vue";
import { SHOWCASE_GOODS } from "@/content/subpages/editorial";
const category = ref("全部好物");
const query = ref("");
const categories = [
  "全部好物",
  ...new Set(SHOWCASE_GOODS.map((item) => item.category)),
];
const categoryCounts = computed(() =>
  Object.fromEntries(
    categories.map((item) => [
      item,
      String(
        item === "全部好物"
          ? SHOWCASE_GOODS.length
          : SHOWCASE_GOODS.filter((good) => good.category === item).length,
      ).padStart(2, "0"),
    ]),
  ),
);
const filtered = computed(() =>
  SHOWCASE_GOODS.filter(
    (item) =>
      (category.value === "全部好物" || item.category === category.value) &&
      [item.title, item.name, item.description, item.category]
        .join(" ")
        .toLowerCase()
        .includes(query.value.trim().toLowerCase()),
  ),
);
</script>

<template>
  <EditorialLayout label="活动预告" index="03" english="ON OUR RADAR">
    <section class="pr-drops-hero pr-wrap">
      <div>
        <p class="pr-eyebrow">
          <span class="pr-orange-dot" /> DISCOVER SOMETHING WORTH YOUR TIME
        </p>
        <h1>下一场，<br />值得期待<span class="pr-orange">。</span></h1>
        <p class="pr-hero-description">
          先发现心动好物，再找到属于你的场次。<br />把一点新鲜感，放进下一次日常。
        </p>
        <a class="pr-text-link" href="/app/"
          >查看商城实时场次 <span aria-hidden="true">↗</span></a
        >
      </div>
      <a href="/app/" class="pr-featured-drop" aria-label="进入商城发现声音好物"
        ><img
          src="/peakrush/drops-20261009/speaker.webp"
          alt="炭黑雕塑展台与橙色声波曲面前的便携音箱"
          fetchpriority="high"
        />
        <div class="pr-featured-drop-label">
          <span>THE EDIT / 声音灵感</span><span aria-hidden="true">↗</span>
        </div>
        <p>ECHO<br /><i>YOUR EVERYDAY.</i></p>
        <span class="pr-featured-caption">让喜欢的声音，跟着日常出发。</span></a
      >
    </section>
    <section class="pr-drops-collection pr-wrap">
      <div class="pr-section-heading">
        <div>
          <p class="pr-eyebrow">THE PEAKRUSH SELECTION</p>
          <h2 class="pr-section-title">你的下一件好物。</h2>
        </div>
        <p class="pr-caption">
          好物灵感预览<br />实际活动安排，请进入商城查看。
        </p>
      </div>
      <div class="pr-filter-bar">
        <div class="pr-filter-tabs" role="group" aria-label="好物分类">
          <button
            v-for="item in categories"
            :key="item"
            :class="{ 'is-active': category === item }"
            :aria-pressed="category === item"
            type="button"
            @click="category = item"
          >
            {{ item }}
            <span>{{ categoryCounts[item] }}</span>
          </button>
        </div>
        <label class="pr-search pr-search-small"
          ><svg viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="10" cy="10" r="6.5" />
            <path d="m15 15 5 5" /></svg
          ><input
            v-model="query"
            type="search"
            placeholder="搜索好物"
            aria-label="搜索好物"
        /></label>
      </div>
      <div class="pr-goods-grid">
        <article v-for="item in filtered" :key="item.key" class="pr-good">
          <a
            class="pr-good-image"
            href="/app/"
            :aria-label="`进入商城查看${item.name}`"
            ><img :src="item.image" :alt="item.imageAlt" loading="lazy" /><span
              aria-hidden="true"
              >↗</span
            ></a
          >
          <div class="pr-good-meta">
            <span>{{ item.english }}</span
            ><span>{{ item.name }}</span>
          </div>
          <h3>{{ item.title }}</h3>
          <p>{{ item.description }}</p>
        </article>
      </div>
      <div v-if="!filtered.length" class="pr-empty" role="status">
        <p>暂时没有找到这件好物。</p>
        <button
          type="button"
          class="pr-text-link"
          @click="
            query = '';
            category = '全部好物';
          "
        >
          查看全部好物 <span aria-hidden="true">↗</span>
        </button>
      </div>
    </section>
    <section class="pr-drop-reminder pr-wrap">
      <div>
        <p class="pr-eyebrow">READY WHEN YOU ARE</p>
        <h2>好物先选好，开抢更从容。</h2>
        <p>
          登录账户，确认活动时间、价格与状态。具体库存与参与结果，以商城为准。
        </p>
      </div>
      <RouterLink class="pr-button" to="/our-product"
        >查看抢购指南 <span aria-hidden="true">↗</span></RouterLink
      >
    </section>
  </EditorialLayout>
</template>
