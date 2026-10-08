<script setup lang="ts">
/**
 * An optional compact storefront notice. It reserves the existing bottom gutter
 * and steps above the storage banner using the shared layout tokens.
 */
withDefaults(defineProps<{ text?: string }>(), {
  text: '进入商城，查看商品与抢购场次。',
});
</script>

<template>
  <aside class="demo-notice" role="note" aria-live="off">
    <span class="demo-notice__dot" aria-hidden="true" />
    <p class="demo-notice__text text-box-trim">{{ text }}</p>
  </aside>
</template>

<style>
/* CLONE-LOCAL: there is no .demo-notice in the reference; the palette and the
   spacing come from its tokens so the notice reads as part of the system. */
.demo-notice {
  align-items: center;
  background-color: var(--c-black);
  border: 1px solid var(--t-line-thin);
  bottom: calc(var(--spacing) + var(--cookie-message-height, 0px));
  color: var(--c-white);
  display: flex;
  gap: var(--spacing-tiny);
  left: var(--spacing);
  max-width: calc(var(--scale-px) * 460);
  padding: calc(var(--scale-px) * 8) calc(var(--scale-px) * 12);
  position: fixed;
  z-index: 900;
}
.demo-notice__dot {
  background-color: var(--c-orange);
  border-radius: 50%;
  flex-shrink: 0;
  height: calc(var(--scale-px) * 8);
  width: calc(var(--scale-px) * 8);
}
.demo-notice__text {
  font-size: calc(var(--scale-text-rem) * 1.3);
  --lh: calc(var(--scale-text-rem) * 2);
  line-height: var(--lh);
  margin: 0;
}
</style>
