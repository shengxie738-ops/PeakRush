<script setup lang="ts">
/**
 * DisplayHeading.vue — the reference `TitleAnimation`
 * (evidence/reference/raw/_nuxt/Bi84onXO.js, `__name:"TitleAnimation"`).
 *
 * The reference renders
 *   <div class="title">
 *     <h1 class="sr-only">{title}</h1>            only when a title prop exists
 *     <div class="title-children-wrapper">slot</div>
 *   </div>
 * so the giant word is an SVG/visual copy while the accessible name is the real
 * heading element with the full string. That structure is reproduced here
 * one-for-one, which is also what the brief asks for: the visual split-letter /
 * split-word copy is aria-hidden and the accessible name stays the whole string.
 *
 * `svgKey` resolves the reference inline glyph set from docs/DOM_CONTRACT.md's
 * owners (FOLLOW.ART, CARD, CONNECTORY, TESTIMONIALS, JOIN US) — parsed verbatim
 * out of the compiled vnode trees into src/content/displayHeadings.json.
 * When a key has no captured SVG the heading falls back to the reference's own
 * text scale (.text-h1/.text-h2/.text-h2-sm from src/styles/typography.css) and
 * the region is marked data-evidence="pending-T01-display-svg".
 */
import { computed } from 'vue';
import { displaySvg } from '@/content/home';

const props = withDefaults(
  defineProps<{
    /** Heading tag for the accessible copy. The home hero is the only h1. */
    is?: string;
    /** Full accessible string (reference `title` prop). */
    title?: string;
    /** Key into src/content/displayHeadings.json. */
    svgKey?: string;
    /** Typography fallback class when no glyph SVG was captured. */
    textClass?: string;
    /** Extra class put on the visual copy (e.g. intro__title). */
    visualClass?: string;
  }>(),
  {
    is: 'h2',
    title: '',
    svgKey: '',
    textClass: 'text-h2',
    visualClass: '',
  },
);

const svg = computed(() => (props.svgKey ? displaySvg(props.svgKey) : null));

/**
 * aria-hidden is injected on the lifted <svg> root itself, and the class list is
 * the union of the reference's own classes (carried verbatim in
 * displayHeadings.json) and the section-specific `visualClass` — deduplicated,
 * because for most sections the two are the same reference class string.
 */
const visualHtml = computed(() => {
  const entry = svg.value;
  if (!entry) return '';
  const cls = Array.from(
    new Set([...entry.class.split(/\s+/), ...props.visualClass.split(/\s+/)].filter(Boolean)),
  ).join(' ');
  return entry.html.replace('class="' + entry.class + '"', 'class="' + cls + '" aria-hidden="true"');
});

const textVisual = computed(() => props.title.toUpperCase());
</script>

<template>
  <div class="title">
    <component :is="is" v-if="title" class="sr-only">{{ title }}</component>
    <div class="title-children-wrapper">
      <!-- the reference's TitleAnimation slot holds the glyph <svg> FIRST and the
           section decoration <img> after it, so the visual and the slot are
           siblings rather than alternatives. -->
      <span
        v-if="svg"
        class="display-heading__visual"
        data-evidence="reference-svg-glyphs"
        v-html="visualHtml"
      />
      <slot />
      <span v-if="!svg" :class="['display-heading__text', textClass]" aria-hidden="true">{{
        textVisual
      }}</span>
    </div>
  </div>
</template>

<style>
/* CLONE-LOCAL: the glyph SVGs size themselves (.title svg{width:100%} in
   typography.css). The visual wrapper must not add a box of its own. */
.title .display-heading__visual {
  display: block;
}
</style>
