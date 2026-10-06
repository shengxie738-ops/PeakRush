<script setup lang="ts">
/**
 * CommunityPage — /community-board.
 *
 * The reference list is client-rendered, so its per-card pixels were never
 * observed (PENDING-01). What IS measured is the list geometry (2 columns inside an
 * 885px column), the sidebar radio groups and the counters, all lifted from the
 * compiled chunks into src/content/subpages/community.ts.
 *
 * Threads are deterministic fixtures produced by threadsForPage(): the clone shows
 * the template, not a copy of the reference's user database (plan §3.3).
 */
import { computed, ref } from 'vue';
import SiteFooter from '@/components/SiteFooter.vue';
import {
  COMMUNITY_PAGE,
  COMMUNITY_SIDEBAR,
  COMMUNITY_MAX_PAGES,
  COMMUNITY_TOTAL_THREADS,
  threadsForPage,
} from '@/content/subpages/community';

const pages = ref(1);
const scope = ref<string>(COMMUNITY_SIDEBAR.scopes[0]);
const sort = ref<string>(COMMUNITY_SIDEBAR.sorts[0]);
const query = ref('');

const threads = computed(() => {
  const all = threadsForPage(1).concat(
    ...Array.from({ length: pages.value - 1 }, (_, i) => threadsForPage(i + 2)),
  );
  const q = query.value.trim().toLowerCase();
  const filtered = q
    ? all.filter((t) => t.headline.toLowerCase().includes(q) || t.author.toLowerCase().includes(q))
    : [...all];
  return sort.value === COMMUNITY_SIDEBAR.sorts[1]
    ? filtered.sort((a, b) => b.comments - a.comments)
    : filtered;
});

const canLoadMore = computed(() => pages.value < COMMUNITY_MAX_PAGES);
const columnStyle = computed(() => ({ '--community-columns': String(COMMUNITY_PAGE.listColumns) }));
</script>

<template>
  <article class="ui-light community-page" data-section-id="community-board" data-page-header-theme="light">
    <div class="section community-layout" :style="columnStyle">
      <header class="community-page__head">
        <h1 :class="COMMUNITY_PAGE.headingClass">{{ COMMUNITY_PAGE.heading }}</h1>
        <p class="community-page__count">{{ COMMUNITY_PAGE.countLabel(COMMUNITY_TOTAL_THREADS) }}</p>
      </header>

      <aside class="connectory-sidebar">
        <fieldset class="radio-group">
          <legend class="sr-only">{{ COMMUNITY_PAGE.heading }}</legend>
          <label v-for="s in COMMUNITY_SIDEBAR.scopes" :key="s" class="form-label form-label--with-input input-radio">
            <input v-model="scope" class="input-radio__input sr-only" type="radio" :name="COMMUNITY_SIDEBAR.scopeName" :value="s" />
            <span class="input-radio__fake" aria-hidden="true" />
            <span>{{ s }}</span>
          </label>
        </fieldset>
        <h2 class="connectory-sidebar__sort-title">{{ COMMUNITY_SIDEBAR.sortTitle }}</h2>
        <fieldset class="radio-group">
          <label v-for="s in COMMUNITY_SIDEBAR.sorts" :key="s" class="form-label form-label--with-input input-radio">
            <input v-model="sort" class="input-radio__input sr-only" type="radio" :name="COMMUNITY_SIDEBAR.sortName" :value="s" />
            <span class="input-radio__fake" aria-hidden="true" />
            <span>{{ s }}</span>
          </label>
        </fieldset>
        <label class="community-search">
          <span class="sr-only">{{ COMMUNITY_SIDEBAR.searchLabel }}</span>
          <input v-model="query" type="search" :placeholder="COMMUNITY_SIDEBAR.searchLabel" />
        </label>
        <button class="btn btn--primary" type="button">{{ COMMUNITY_SIDEBAR.createLabel }}</button>
      </aside>

      <ul class="community-list" :data-columns="COMMUNITY_PAGE.listColumns">
        <li v-for="t in threads" :key="t.id" class="community-card" :data-variant="t.variant">
          <img v-if="t.image" class="community-card__media" :src="t.image" :alt="t.headline" />
          <p v-if="t.pinned" class="community-card__pin">Pinned</p>
          <h3 class="community-card__headline">{{ t.headline }}</h3>
          <p v-for="(para, i) in t.body" :key="i" class="community-card__body">{{ para }}</p>
          <footer class="community-card__meta">
            <span class="community-card__author">{{ t.author }}</span>
            <time>{{ t.date }}</time>
            <span>{{ t.comments }} comments</span>
            <span>{{ t.likes }} likes</span>
          </footer>
        </li>
      </ul>

      <button v-if="canLoadMore" class="btn btn--outline community-page__more" type="button" @click="pages += 1">
        {{ COMMUNITY_PAGE.loadMoreLabel }}
      </button>
      <p v-else class="community-page__end">End of the demo fixture set — {{ threads.length }} of {{ COMMUNITY_TOTAL_THREADS }} threads shown.</p>
    </div>
    <SiteFooter />
  </article>
</template>
