<script setup lang="ts">
/**
 * TextSwap — the reference's one-word-at-a-time rotator, as measured on /pricing
 * (evidence/reference/pricing-plans-difference-measured.md and
 * evidence/reference/raw/promo-dom.json, promo-svg.json, text-swap-rules.json).
 *
 * Model, all of it observed rather than assumed:
 *   `.text-swap` is `display: inline-grid` with a single named area, so every word occupies the
 *   same cell and the box is as wide as the WIDEST word (143.75px for four words of differing
 *   length) and never reflows as the cycle advances.
 *   Each `.text-swap-item` is `--clip` plus exactly one of `--out-top` / `--active` /
 *   `--out-bottom`. The index rule that matched both samples:
 *     i < active  -> --out-top      i === active -> --active      i > active -> --out-bottom
 *   Only the active word's underline carries `--shown`.
 *   Nothing is a CSS @keyframes: movement is a `transition` of `transform, clip-path` over
 *   1.5s cubic-bezier(0.55, 0, 0.1, 1), so the state machine is driven by swapping classes.
 *   The class swap happens every 30s, measured off the live element's mutation timestamps —
 *   evidence/reference/textswap-dwell-measured.md. Do not confuse that with the 1.5s transition.
 *
 * NOT measured: reduced-motion behaviour of the swap itself, and whether the timer is
 * viewport-gated. Neither is observable without a visible surface.
 */
import { onBeforeUnmount, onMounted, ref } from 'vue';
import BrushLink from './BrushLink.vue';

/** Dwell between advances: 13 consecutive gaps at 29.9-30.1s on the live reference. The 1.5s
 *  transition itself is a CSS declaration (src/styles/typography.css:267), not a JS value. */
const SWAP_DWELL_SEC = 30;

const props = defineProps<{
  /** Words in DOM order. The reference renders all of them up front, just clipped. */
  items: readonly string[];
  /** Stop cycling, e.g. for a capture that must land on a fixed word. */
  frozen?: boolean;
}>();

const active = ref(0);
let timer: ReturnType<typeof setInterval> | undefined;

function stateOf(index: number): string {
  if (index === active.value) return 'text-swap-item--active';
  return index < active.value ? 'text-swap-item--out-top' : 'text-swap-item--out-bottom';
}

function classesFor(index: number): string {
  return ['text-swap-item', 'text-swap-item--clip', stateOf(index)].join(' ');
}

onMounted(() => {
  if (props.frozen) return;
  // Reduced motion keeps the first word shown instead of cycling; the reference's own entrance
  // machinery behaves the same way, and tests/lifecycle asserts we do.
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  timer = setInterval(() => {
    active.value = (active.value + 1) % props.items.length;
  }, SWAP_DWELL_SEC * 1000);
});

onBeforeUnmount(() => {
  if (timer !== undefined) clearInterval(timer);
});

defineExpose({ active, classesFor });
</script>

<template>
  <span class="text-swap">
    <span v-for="(item, index) in items" :key="item" :class="classesFor(index)">
      <BrushLink underline :show="index === active" underline-variant="accent" :transition-delay="0">
        {{ item }}
      </BrushLink>
    </span>
  </span>
</template>
