<script setup lang="ts">
/**
 * LegalPage — one template for /terms-and-conditions, /privacy-policy and
 * /cookies-policy, selected by the route prop.
 *
 * The wording is the reference's own text, lifted from the server-rendered HTML
 * (see evidence/reference/raw and LEGAL_DOCS). Displaying it does not make this
 * local clone a party to it — LEGAL_DISCLAIMER says so on the page itself.
 *
 * Layout is bound to evidence/reference/subpages-measured.md (2026-10-01): the page is
 * a 12-column row whose RIGHT half is the heading column
 * `col col:12 col--6:md col--last:md text-page-title pb-1` at [698, 76, 659, 696], and
 * the heading is a *visible* `h1.text-box-trim.text-right:md.mb-4.mb-0:md` at the h1
 * scale (250.148px measured) — not an sr-only heading paired with a glyph SVG, which is
 * the model the home page uses. Prose occupies the left 6 columns.
 *
 * Two earlier defects lived here: the wrapper carried a hardcoded `ui-light`, which
 * forced a white ground on routes the reference tints pink/green/pink, and the heading
 * was a full-width banner stacked above the prose.
 */
import { computed } from 'vue';
import { useRoute } from 'vue-router';
import SiteFooter from '@/components/SiteFooter.vue';
import { LEGAL_DOCS, LEGAL_DISCLAIMER, type LegalBlock } from '@/content/subpages/legal';

const props = defineProps<{ document: 'terms-and-conditions' | 'privacy-policy' | 'cookies-policy' }>();
const doc = computed(() => LEGAL_DOCS[props.document]);

/** The page ground is a route property, so take it from the route instead of fixing it. */
const route = useRoute();
const theme = computed(() => (route.meta.theme as string) ?? 'light');

/** Consecutive `li` blocks become one real list so the reading order is semantic,
 *  not a run of paragraphs styled as bullets. */
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
          <p v-for="(line, i) in LEGAL_DISCLAIMER" :key="i">{{ line }}</p>
        </aside>
      </div>
      <div class="col col:12 col--6:md col--last:md text-page-title pb-1">
        <h1 class="text-box-trim text-right:md mb-4 mb-0:md">{{ doc?.title ?? props.document }}</h1>
        <p class="text-page-updated">{{ doc?.lastUpdated }}</p>
        <hr />
      </div>
    </div>
    <SiteFooter />
  </article>
</template>

<style>
/* CLONE-LOCAL: the reference heading column is the right half of the grid and the
   prose the left half; `col--last:md` supplies the order. Nothing here overrides a
   measured value — it only stops the 250px heading from forcing the row wider. */
.text-page-title h1 {
  overflow-wrap: break-word;
}
</style>
