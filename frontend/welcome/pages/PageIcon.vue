<script setup lang="ts">
/**
 * PageIcon.vue — CLONE-LOCAL (src/pages/ lane) reproduction of the reference
 * `Icon` element.
 *
 * The reference renders (evidence/reference/raw/_nuxt/Bi84onXO.js, table `ek`
 * consumed by `nk()`):
 *   <svg class="icon icon-{name}" role="presentation" width="{W}px" height="{H}px"
 *        viewBox="0 0 W H" style="--icon-width:W;--icon-height:H">
 *     <use href="#{name}"/>
 *   </svg>
 * and `src/styles/tokens.css` sizes it with
 *   .icon{height:calc(var(--icon-height)*var(--scale-px));width:calc(var(--icon-width)*var(--scale-px))}
 *
 * The W/H pairs below are read out of that same captured table in
 * evidence/reference/raw/_nuxt/Bi84onXO.js, so no size is guessed. The symbol
 * itself comes from the sprite App.vue mounts once (src/content/assetRegistry.ts,
 * ICON_SPRITE) — no request.
 */
const SIZES: Record<string, { width: number; height: number }> = {
  'arrow-open': { width: 8, height: 8 },
  'checkbox-mark': { width: 16, height: 16 },
  'login-facebook': { width: 16, height: 16 },
  'login-google': { width: 16, height: 16 },
  'message-comment': { width: 18, height: 18 },
  'message-like': { width: 18, height: 18 },
  password: { width: 18, height: 18 },
  preview: { width: 18, height: 18 },
  'promo-checkbox-mark': { width: 14, height: 14 },
  'promo-more': { width: 20, height: 20 },
  'promo-more-close': { width: 20, height: 20 },
  'promo-next': { width: 14, height: 14 },
  'promo-stage-current': { width: 20, height: 20 },
  'question-mark': { width: 18, height: 18 },
  search: { width: 17, height: 17 },
  'select-list-arrow': { width: 18, height: 18 },
  'select-list-arrow-icon': { width: 8, height: 8 },
  'step-next': { width: 18, height: 18 },
  support: { width: 23, height: 21 },
  upload: { width: 18, height: 18 },
  hover: { width: 173, height: 22 },
};

const props = withDefaults(
  defineProps<{
    name: string;
    extraClass?: string;
    /** Reference marks decorative icons with role="presentation". */
    decorative?: boolean;
    label?: string;
  }>(),
  { extraClass: '', decorative: true, label: '' },
);

const size = () => SIZES[props.name] ?? { width: 18, height: 18 };
</script>

<template>
  <svg
    :class="['icon', `icon-${props.name}`, props.extraClass]"
    :role="props.decorative ? 'presentation' : 'img'"
    :aria-label="props.decorative ? undefined : props.label || undefined"
    :width="`${size().width}px`"
    :height="`${size().height}px`"
    :viewBox="`0 0 ${size().width} ${size().height}`"
    :style="{ '--icon-width': size().width, '--icon-height': size().height }"
  >
    <use :href="`#${props.name}`" />
  </svg>
</template>
