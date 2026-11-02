<script setup lang="ts">
/**
 * FixedSignUpButton — the black "Join" button pinned to the lower-right.
 *
 * An earlier revision of this component tried to move the button onto whichever
 * `.fixed-sign-up-button-stub` was currently in view. That was wrong: the measured
 * reference rect is [1150,676,207,76] at viewport 1376x772, i.e. right-aligned with
 * the standard gutter (1376 - 207 - 19 = 1150), while the first stub sits at x=634.
 * Tracking the stub put the button at 634 and dragged it off-screen on scroll.
 *
 * The reference rule, transcribed from the captured stylesheet, is simply:
 *   .fixed-sign-up-button { position:fixed; display:grid; z-index:var(--md,4);
 *     right:var(--spacing); bottom:calc(var(--spacing) + var(--cookie-message-mobile-height,0px));
 *     width:var(--md,15.0684931507vw) }
 *   .fixed-sign-up-button-stub { width:var(--sign-up-width); height:var(--sign-up-height) }
 * so the button is anchored to the viewport and the stubs only reserve in-flow space
 * in the sections it visually overlaps. The `--transition-header` class is the
 * reference's own transition for it, kept here verbatim.
 *
 * MEASURED, from the live element (its box read flat orange in the first reference
 * screenshot while the reference paints a solid black block — the DOM rect had matched,
 * so geometry alone hid this):
 *   <a class="btn btn--start btn--primary btn--full btn--accent btn--large
 *            fixed-sign-up-button__btn">
 *     rect [1150,676,207,76], height 76.4375px, font-size 19.4668px, color #fff
 *     --btn-background #000 · --btn-text #fff · --btn-accent #f4793a
 *     --btn-height calc(clamp(.5px,.06944vw,1px)*80)
 *   .btn:after { position:absolute; inset:0; content:""; background:rgb(0,0,0) }
 * `.btn` itself is `background-color: transparent` — ALL of the paint lives on the
 * `:after` layer driven by `--btn-background`, which only `.btn--primary` supplies
 * (`--t-button_primary_background: var(--c-black)`). Carrying just `btn btn--start`,
 * as this component did, left the button invisible-on-orange with black text and a
 * natural 38px height, which an earlier revision had papered over with a hardcoded
 * `height: var(--sign-up-height)`. That workaround is gone: `btn--large` now provides
 * the real height through `--btn-height`.
 */
import { JOIN } from '@/content/home';
</script>

<template>
  <div class="fixed-sign-up-button fixed-sign-up-button--transition-header">
    <a
      class="btn btn--start btn--primary btn--full btn--accent btn--large fixed-sign-up-button__btn"
      :href="JOIN.to"
    >
      <span class="btn__content">
        <span class="btn__text">{{ JOIN.button }}</span>
        <svg class="btn__icon" viewBox="0 0 24 24" width="24" height="24" aria-hidden="true" focusable="false">
          <circle cx="12" cy="12" r="11" fill="none" stroke="currentColor" />
          <path d="M8 12h8M13 8l4 4-4 4" fill="none" stroke="currentColor" />
        </svg>
        <span class="sr-only">{{ JOIN.srLabel }}</span>
      </span>
    </a>
  </div>
</template>

<style>
.fixed-sign-up-button {
  bottom: calc(var(--spacing) + var(--cookie-message-mobile-height, 0px));
  display: grid;
  position: fixed;
  right: var(--spacing);
  width: var(--md, 15.0684931507vw);
  z-index: var(--md, 4);
}
.fixed-sign-up-button--transition-header {
  transition: transform 1.5s cubic-bezier(0.55, 0, 0.1, 1);
}
.fixed-sign-up-button--transition-card-flipping {
  transition: transform 0.8s cubic-bezier(0.55, 0, 0.1, 1);
}
.fixed-sign-up-button--hidden {
  opacity: 0;
  z-index: -20 !important;
}
.fixed-sign-up-button__btn {
  width: 100%;
}
</style>
