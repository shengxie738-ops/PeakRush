<script setup lang="ts">
/** 三类使用说明共用双栏模板与路由配色。 */
import { computed } from 'vue';
import { useRoute } from 'vue-router';
import SiteFooter from '@/components/SiteFooter.vue';
import { LEGAL_DOCS, LEGAL_NOTICE, type LegalBlock } from '@/content/subpages/legal';

const props = defineProps<{ document: 'terms-and-conditions' | 'privacy-policy' | 'cookies-policy' }>();
const doc = computed(() => LEGAL_DOCS[props.document]);

const route = useRoute();
const theme = computed(() => (route.meta.theme as string) ?? 'light');

/** 相邻的条目合为一个语义化列表。 */
type Run = { kind: 'block'; block: LegalBlock } | { kind: 'list'; blocks: LegalBlock[] };
const runs = computed<Run[]>(() => {
  const out: Run[] = [];
  for (const block of doc.value?.blocks ?? []) {
    if (block.t === 'li' && out.length && out[out.length - 1].kind === 'list') {
      (out[out.length - 1] as Extract<Run, { kind: 'list' }>).blocks.push(block);
    } else if (block.t === 'li') {
      out.push({ kind: 'list', blocks: [block] });
    } else {
      out.push({ kind: 'block', block });
    }
  }
  return out;
});

</script>

<template>
  <article
    class="text-page"
    :class="'ui-' + theme"
    :data-section-id="props.document"
    :data-page-header-theme="theme"
  >
    <div class="section row row--gx px-1 ui-background">
      <div class="col col:12 col--6:md text-page-content">
        <template v-for="(run, i) in runs" :key="i">
          <ul v-if="run.kind === 'list'" class="legal-list">
            <li v-for="(b, j) in run.blocks" :key="j">{{ b.x }}</li>
          </ul>
          <h2 v-else-if="run.block.t === 'h2'">{{ run.block.x }}</h2>
          <h3 v-else-if="run.block.t === 'h3'">{{ run.block.x }}</h3>
          <p v-else>{{ run.block.x }}</p>
        </template>
        <aside class="legal-disclaimer">
          <p v-for="(line, i) in LEGAL_NOTICE" :key="i">{{ line }}</p>
        </aside>
      </div>
      <div class="col col:12 col--6:md col--last:md text-page-title pb-1">
        <h1 class="text-box-trim text-right:md mb-4 mb-0:md">{{ doc?.title ?? '使用说明' }}</h1>
        <p class="text-page-updated">{{ doc?.lastUpdated }}</p>
        <hr />
      </div>
    </div>
    <SiteFooter />
  </article>
</template>

<style>
/* 保留右侧标题栏，长标题在栏内换行。 */
.text-page-title h1 {
  overflow-wrap: break-word;
}
</style>
