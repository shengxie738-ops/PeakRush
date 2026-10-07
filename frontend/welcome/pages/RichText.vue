<script setup lang="ts">
/**
 * RichText.vue — CLONE-LOCAL (src/pages/ lane) renderer for the mini-markdown used
 * by src/content/subpages/faq.ts and about.ts.
 *
 * It exists because the reference answers are server-rendered HTML (`<p>`, `<b>`,
 * `<a href="/signup">`, `<ul><li>`), and the clone has to reproduce that structure
 * without putting raw HTML strings through v-html. Only three constructs are
 * recognised: `**bold**`, `[text](target)` and `- ` block prefixes.
 *
 * Block rules, matching the measured FAQ DOM:
 *   consecutive "- " blocks become one <ul> of <li>; every other block is a <p>.
 * Targets beginning with "/" go through RouterLink (SPA), everything else is a
 * plain anchor (mailto:, https:) — no request is made by rendering either.
 */
import { computed } from 'vue';
import { RouterLink } from 'vue-router';

interface Token {
  t: 'text' | 'b' | 'a';
  x: string;
  href?: string;
}

const PATTERN = /\*\*([^*]+)\*\*|\[([^\]]+)\]\(([^)]+)\)/g;

function tokenize(source: string): Token[] {
  const tokens: Token[] = [];
  let last = 0;
  let match: RegExpExecArray | null;
  PATTERN.lastIndex = 0;
  while ((match = PATTERN.exec(source)) !== null) {
    if (match.index > last) tokens.push({ t: 'text', x: source.slice(last, match.index) });
    if (match[1] !== undefined) tokens.push({ t: 'b', x: match[1] });
    else tokens.push({ t: 'a', x: match[2], href: match[3] });
    last = match.index + match[0].length;
  }
  if (last < source.length) tokens.push({ t: 'text', x: source.slice(last) });
  return tokens;
}

interface Chunk {
  kind: 'p' | 'ul';
  items: string[];
}

const props = withDefaults(
  defineProps<{ blocks: readonly string[]; as?: string }>(),
  { as: 'div' },
);

const chunks = computed<Chunk[]>(() => {
  const out: Chunk[] = [];
  for (const block of props.blocks) {
    if (block.startsWith('- ')) {
      const tail = out[out.length - 1];
      if (tail && tail.kind === 'ul') tail.items.push(block.slice(2));
      else out.push({ kind: 'ul', items: [block.slice(2)] });
    } else {
      out.push({ kind: 'p', items: [block] });
    }
  }
  return out;
});

function isInternal(href: string): boolean {
  return href.startsWith('/');
}
</script>

<template>
  <component :is="props.as" class="rich-text">
    <template v-for="(chunk, chunkIndex) in chunks" :key="chunkIndex">
      <p v-if="chunk.kind === 'p'">
        <template v-for="(token, i) in tokenize(chunk.items[0])" :key="i">
          <b v-if="token.t === 'b'">{{ token.x }}</b>
          <RouterLink v-else-if="token.t === 'a' && token.href && isInternal(token.href)" :to="token.href">{{ token.x }}</RouterLink>
          <a v-else-if="token.t === 'a'" :href="token.href" rel="noopener">{{ token.x }}</a>
          <template v-else>{{ token.x }}</template>
        </template>
      </p>
      <ul v-else>
        <li v-for="(item, i) in chunk.items" :key="i">
          <template v-for="(token, j) in tokenize(item)" :key="j">
            <b v-if="token.t === 'b'">{{ token.x }}</b>
            <RouterLink v-else-if="token.t === 'a' && token.href && isInternal(token.href)" :to="token.href">{{ token.x }}</RouterLink>
            <a v-else-if="token.t === 'a'" :href="token.href" rel="noopener">{{ token.x }}</a>
            <template v-else>{{ token.x }}</template>
          </template>
        </li>
      </ul>
    </template>
  </component>
</template>
