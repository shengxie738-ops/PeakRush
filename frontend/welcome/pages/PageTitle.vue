<script setup lang="ts">
/**
 * PageTitle.vue — CLONE-LOCAL (src/pages/ lane) emit of the reference `Title`
 * contract (`src/styles/typography.css`: `.title{position:relative}`,
 * `.title svg{display:block;height:auto;width:100%}`).
 *
 * The reference pairs a real, accessible heading with a vector copy of the same
 * words:
 *   <div class="title"><h1 class="sr-only">Subscription & Pricing</h1>
 *     <div class="title-children-wrapper"><svg …>one <path> per glyph</svg></div></div>
 * Those glyph sets were never downloaded into displayHeadings.json, so the visual
 * line is rendered from the reference's own text scale (`.text-h1/.text-h2/
 * .text-h2-sm`, all measured per page) and the region carries
 * data-evidence="pending-T00-subpage" instead of pretending to be the artwork.
 *
 * Pages whose heading is genuine text (FAQ, the legal documents, the plan cards)
 * pass `visible`, which puts the words in the heading element itself — exactly as
 * measured on those pages.
 */
const props = withDefaults(
  defineProps<{
    is?: 'h1' | 'h2' | 'h3';
    /** Accessible string (reference `title` prop). */
    title: string;
    /** Visual lines; empty array = no visual copy. */
    visual?: readonly string[];
    /** Reference type-scale class for the visual copy. */
    textClass?: string;
    wrapperClass?: string;
    /** true when the reference paints the heading itself as text. */
    visible?: boolean;
    /** Extra class on the heading when the reference gives it one. */
    headingClass?: string;
    /** Whether the pending glyph SVG should be flagged. */
    pending?: boolean;
  }>(),
  {
    is: 'h1',
    visual: () => [],
    textClass: 'text-h2',
    wrapperClass: '',
    visible: false,
    headingClass: '',
    pending: true,
  },
);
</script>

<template>
  <div v-if="!visible" class="title" :class="props.wrapperClass">
    <component :is="props.is" :class="['sr-only', props.headingClass]">{{ props.title }}</component>
    <div class="title-children-wrapper">
      <span
        v-if="props.visual.length"
        :class="['page-title__visual', props.textClass]"
        :data-evidence="props.pending ? 'pending-T00-subpage' : undefined"
        aria-hidden="true"
      >
        <template v-for="(line, index) in props.visual" :key="line">
          <br v-if="index > 0" />{{ line }}
        </template>
      </span>
      <slot />
    </div>
  </div>

  <component v-else :is="props.is" :class="[props.textClass, props.headingClass]">
    {{ props.title }}
  </component>
</template>

<style>
/* CLONE-LOCAL: the vector word-marks of the reference fill their column and wrap
   deliberately. The text fallback keeps the reference type scale but must never
   push the page wide, so it is line-wrapped and clipped to the grid. */
.page-title__visual {
  display: block;
  overflow-wrap: break-word;
  white-space: normal;
}
</style>
