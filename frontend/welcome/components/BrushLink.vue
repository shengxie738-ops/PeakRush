<script setup lang="ts">
/**
 * BrushLink.vue — the reference link/CTA component with its brush-stroke reveal.
 *
 * Two modes, both lifted from the reference (no invented DOM):
 *
 *  1. button mode — the reference `Button` (evidence/reference/raw/_nuxt/Bi84onXO.js
 *     `__name:"Button"`), whose `.btn--accent` variant paints the brush sweep
 *     `<svg class="btn__hover-accent icon icon-hover">` (icon table entry
 *     `{icon:"hover",width:173,height:22,description:"Accent hover effect icon"}`)
 *     behind the label. DOM emitted:
 *       <a class="not-nuxt-link btn btn--link btn--block btn--accent …">
 *         <svg class="btn__hover-accent icon icon-hover" …><use href="#hover"/></svg>
 *         <span class="btn__content">
 *           <span class="btn__text"> … <span class="btn__text-text">title</span></span>
 *           <svg class="btn__icon icon icon-…"/>
 *         </span>
 *       </a>
 *     The reference renders a plain <a> and pushes the route on click; this clone
 *     uses <RouterLink> for internal `to` so the SPA does not reload.
 *
 *  2. underline mode (`underline` prop) — the reference `TextUnderlineAnimation`
 *     (BpOVlWAq.js), used for the scroll-revealed words " All in one ", " No more ",
 *     " Support Me ", " global ", " Create Your " and for the cookie "cookies" link.
 *     DOM: <span class="underline-text-piece underline-text-piece--shown?">
 *           <svg class="underline-text-piece__decoration" viewBox="0 0 82 4">…</svg>
 *           <span class="underline-text-piece__content">…</span></span>
 *     The <path> data is byte-for-byte the reference path.
 */
import { computed } from 'vue';
import { RouterLink } from 'vue-router';
import { iconAttrs, iconId } from '@/content/assetRegistry';

/** Verbatim `<path d>` of .underline-text-piece__decoration (BpOVlWAq.js). */
const UNDERLINE_PATH =
  'M81.8 1.8c-.1 0-.2-.1-.1-.2l-.2-.4-.2-.3c.4 0-1-.4-2-.5a23.6 23.6 0 0 0-5.5-.1c0-.2-.3-.2-2.5-.2a4751 4751 0 0 1-23.2 0h-.7a3189.9 3189.9 0 0 0-21.8.1L23 .3h-2.7a.6.6 0 0 1-.3.2c-.1 0-.2 0 0-.1h-1.3A135.9 135.9 0 0 1 7.6.4H5.8c.1.2-.4.1-1 0h-1L3 .6H1.9c-.5 0-.8 0-.7.1 0 .1 0 .2-.2.2H.8L.4.7 0 1l.2.1c.1 0 .2 0 0 .2 0 .1.1.2.6.1.5 0 .7 0 .6.2 0 .1.1.2.3.2H2c0 .1 0 .3.2.5s.2.3.1.3l.3.1 1.5.1c1 0 1 0 .9.2h1.5c.3 0 .4 0 .3-.1a.8.8 0 0 1-.2-.4c-.1-.3 0-.3.4 0l.3.4c-.1 0 0 .1 0 .2.2 0 .5 0 .7-.2.3-.3.4-.3.5 0 .2.4.5.3.3 0 0-.3-.1-.4-.3-.4 0 0-.1 0 0 0H9c.4.1.4.1.2-.1C9 2 8.9 2 8.8 2L8.7 2c0-.1 0-.2.3-.2h.2c0 .1 0 .3.2.5.2.1.2.3.1.3-.5.2-.2.4.5.4l.8.1c.1.2.2.2.5 0 .4-.2.4-.2.4 0h.3v-.3c-.2 0-.2-.1 0-.2.3 0 .4 0 .4.2s.1.4.6.5h.9c.1 0 .3-.1.4 0l.3-.1a.6.6 0 0 1 .3-.2c.2 0 .2.1 0 .2-.2.2-.2.2.2.3h.7c.3-.2.7-.2 1.3 0 .4 0 .5 0 .4-.2l.2.1c.2.2.3.3.4.1h.7l.6.2c-.2-.2.6-.3.8-.2.3.2.9.2.7 0h2c.3.2.5.2.7 0 .2-.1.6-.1.4 0 0 .1.2.2.7.2.6 0 .9 0 .8.1-.2.2 0 .1.6-.1.4-.3.4-.3.5-.1 0 .1.2.2.3.1a3 3 0 0 1 1.9 0c.6.4 3.3.3 3 0-.2-.2 0-.2.4 0 .2.2.3.2.3.1l.3-.1c.2 0 .3 0 .2.1h1.1c-.2-.2.3-.3 1.2-.3l1.1-.1c.2-.1.3 0 .2 0-.1.2 0 .2.4.2.3 0 .6 0 .7.2h.3c0-.1.2-.3.5-.3h.4v.2c.2 0 .3 0 .3-.2h.5c.7.3 1.2.3 1.2.1 0-.2 0-.2 1.4-.2h.9s.1.1.2 0h1.8c.9 0 1.5-.1 1.5-.2L47 3c.1 0 .2 0 .1.2-.2.1.5.2.9 0h.4c0 .1.2.2.3.1 0 0 .2 0 .2.2s1.1.1 1.3 0a.5.5 0 0 1 .4-.2s.1 0 0 .1c0 .1 0 .2.2.1h.6l.1.1s0-.2.2-.2h.2s0 .2.2.2h.2l.1-.2 1-.1c.2-.1.3-.1.2 0l.2.1.4-.1h.4c.2.2.3.2.8 0 .5-.3.6-.4.6-.2s0 .2.3 0h.4c0 .2.2.2.4.3.2 0 .3 0 .2-.1l.2-.1.4.1c0 .1 0 .1.2 0 .3-.1 1.2-.2 1.3 0v-.1c0-.2.4-.2.9 0 .3.3.4.3.5 0h.9l1.2-.2h2.3l.5-.2.4-.1c0-.1 0-.2.2-.1l.1.2c0 .2 0 .2.2.2h.4l.8-.2c.7 0 .8 0 1 .3.1.2.2.2.2 0s.6-.4 1.1-.2c.2 0 .4 0 .5-.2.1-.1.2-.2.3 0l.6.2c.4 0 .5-.1.5-.4 0-.1 0 0 .2 0 .2.2.6.2 1.4.2.6 0 1.2 0 1.2-.2h.4l.2.3h.6l.4-.2c.7-.1.8-.1.8.1s0 .2.4 0 .5-.3.6-.2h2.1c0 .1.2.1.4 0h.6c.1.1.7-.3.7-.6l-.2-.1Zm-.8-.4.1-.2c.3-.1.3 0 .1 0 0 .2-.1.3-.2.2Zm-3.7 1c-.2 0-.3 0-.2-.1l.3-.2c.3 0 .2.1-.1.2ZM73.4 2h-.2l.2-.2.2.1-.2.1Zm-5.7.4c-.2 0-.2-.1.1 0l.3.1h-.4Zm-5.8.2-.2-.2h.2l.2.1h-.2Zm-7.1.7.1-.3c.2 0 .3 0 .1.1l-.2.2Zm-.6-.6H54l.3-.1h.3c0 .1-.1.2-.3.1Zm-14 .9-.2-.2v-.1c.3 0 .4.3.2.3Zm-10.8.2.1-.3c.3 0 .3 0 .2.1l-.3.2ZM23 3h-.2c0-.2.2-.2.3-.1.3 0 .2.1-.1.1ZM18 1.7l.3-.1h.1c-.1.1-.3.2-.4.1Zm-1.6 1.5a.4.4 0 0 1-.2-.2c-.1 0 0 0 0 0h.3l-.1.2Zm-1-.7s-.2 0-.2-.2c0 0 .1-.1.2 0h.2l-.2.2Zm-.4.4c-.2 0-.1-.1 0-.1h.4c-.1.1-.3.1-.4 0Zm-.3-.2c-.2 0-.3-.1-.2-.2a.4.4 0 0 1 .3 0c.3 0 .2.2-.1.2Zm-1.4.4h-.7c-.2-.2-.2-.2 0-.1h.4c.2-.3.7-.3.7-.1 0 0-.1.2-.4.2Zm-2.3-1.3-.4-.2h.4l.4.2h-.4Zm-2-.4c-.2 0-.3 0-.3-.2H9l.2.1H9Zm-1.3.3-.4-.1h-.2L7 1.3c-.2 0-.1-.1.1-.2h.3c-.1.1 0 .2.2.2.1 0 .3.2.2.3Zm-4 .1c-.7 0-.9-.1-.3-.2l1 .2h-.7Zm-.3.8c-.6 0-1-.2-.9-.4H3l.6.2.4.1-.5.1Zm-1-1.2c.3 0 .2.1 0 .1-.5 0-.4-.3 0-.3.2 0 .2 0 0 0s-.2.1 0 .2Zm0 .5-.2-.1c0-.1 0-.2.2-.2l.2.2c0 .1-.1.2-.2.1Z';

const props = withDefaults(
  defineProps<{
    /** Internal route (rendered through RouterLink). */
    to?: string;
    /** Raw href (external links, mailto:, #anchors). */
    href?: string;
    /** Open in a new tab (reference `target` prop). */
    external?: boolean;
    /** Reference variant list, space separated: "link block accent". */
    variant?: string;
    size?: string;
    textSize?: string;
    iconSpacing?: string;
    icon?: string;
    iconPosition?: 'left' | 'right';
    title?: string;
    /** Native title attribute (reference `attrTitle`). */
    attrTitle?: string;
    badge?: string;
    ariaLabel?: string;
    disabled?: boolean;
    active?: boolean;
    loading?: boolean;
    /** Extra classes merged onto the root, exactly like the reference `class` prop. */
    class?: string;
    /** Underline (TextUnderlineAnimation) mode instead of / around the link. */
    underline?: boolean;
    /** Reveal state of the underline piece. */
    show?: boolean;
    underlineVariant?: string;
    transitionDelay?: number;
    /** Force a <button> root (local demo actions). */
    asButton?: boolean;
    type?: string;
  }>(),
  {
    to: '',
    href: '',
    external: false,
    variant: 'primary accent',
    size: '',
    textSize: '',
    iconSpacing: '',
    icon: '',
    iconPosition: 'right',
    title: '',
    attrTitle: '',
    badge: '',
    ariaLabel: '',
    disabled: false,
    active: false,
    loading: false,
    class: '',
    underline: false,
    show: false,
    underlineVariant: '',
    transitionDelay: 0,
    asButton: false,
    type: '',
  },
);

const emit = defineEmits<{ (event: 'click', payload: MouseEvent): void }>();

const hasText = computed(() => Boolean(props.title));
const isAccent = computed(() => props.variant.split(' ').includes('accent'));
const isAnchor = computed(() => Boolean(props.to && !props.to.startsWith('#')));
const rawHref = computed(() => {
  if (props.to && props.to.startsWith('#')) return props.to;
  return props.href || null;
});
const rootElement = computed(() => {
  if (props.asButton || (!isAnchor.value && !rawHref.value)) return 'button';
  return isAnchor.value ? RouterLink : 'a';
});

/** `vn({btn:!0,…})` from Bi84onXO.js, reproduced for the classes this clone uses. */
const btnClass = computed(() => {
  const parts: string[] = ['not-nuxt-link', 'btn'];
  if (props.active) parts.push('is-active');
  if (props.disabled) parts.push('is-disabled');
  if (props.loading) parts.push('is-loading');
  if (props.icon && hasText.value) parts.push('btn--space-between');
  if (props.icon && !hasText.value && !props.variant.includes('square')) parts.push('btn--start');
  for (const token of props.variant.split(' ')) if (token) parts.push('btn--' + token);
  if (props.size) parts.push('btn--' + props.size);
  if (props.textSize) parts.push('btn--text-' + props.textSize);
  if (props.iconSpacing) parts.push('btn--icon-spacing-' + props.iconSpacing);
  if (props.class) parts.push(props.class);
  return parts.join(' ');
});

const underlineClass = computed(() => {
  const parts = ['underline-text-piece'];
  if (props.show) parts.push('underline-text-piece--shown');
  if (props.underlineVariant) parts.push('underline-text-piece--' + props.underlineVariant);
  return parts.join(' ');
});

const decorationStyle = computed(() => ({ 'transition-delay': `${props.transitionDelay}s` }));

function onClick(event: MouseEvent): void {
  if (props.disabled || props.loading) {
    event.preventDefault();
    return;
  }
  emit('click', event);
}
</script>

<template>
  <span v-if="underline" :class="underlineClass">
    <svg
      class="underline-text-piece__decoration"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      preserveAspectRatio="none"
      viewBox="0 0 82 4"
      :style="decorationStyle"
      aria-hidden="true"
    >
      <path fill="currentColor" fill-rule="evenodd" :d="UNDERLINE_PATH" clip-rule="evenodd" />
    </svg>
    <span class="underline-text-piece__content">
      <component
        :is="rootElement"
        v-if="to || href || asButton"
        :class="btnClass"
        :to="to || undefined"
        :href="rawHref || undefined"
        :role="asButton ? undefined : null"
        :target="external ? '_blank' : undefined"
        :rel="external ? 'noopener' : undefined"
        :aria-label="ariaLabel || null"
        :title="attrTitle || undefined"
        :disabled="asButton && disabled ? true : undefined"
        :type="type || undefined"
        @click="onClick"
      >
        <slot />
      </component>
      <slot v-else />
    </span>
  </span>

  <component
    :is="rootElement"
    v-else
    :class="btnClass"
    :to="to || undefined"
    :href="rawHref || undefined"
    :role="asButton ? undefined : rootElement === 'button' ? null : 'link'"
    :tabindex="disabled ? -1 : undefined"
    :target="external ? '_blank' : undefined"
    :rel="external ? 'noopener' : undefined"
    :aria-label="ariaLabel || null"
    :title="attrTitle || undefined"
    :disabled="asButton && disabled ? true : undefined"
    :type="type || (asButton ? 'button' : undefined)"
    @click="onClick"
  >
    <span v-if="badge" class="btn__badge text-box-trim">{{ badge }}</span>
    <svg
      v-if="icon && !hasText && isAccent"
      v-bind="iconAttrs('hover')"
      class="btn__hover-accent"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <use :href="`#${iconId('hover')}`" />
    </svg>
    <span class="btn__content">
      <template v-if="icon">
        <span v-if="iconPosition === 'right' && (hasText || $slots.default)" class="btn__text">
          <svg
            v-if="isAccent"
            v-bind="iconAttrs('hover')"
            class="btn__hover-accent btn__hover-accent--text"
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            <use :href="`#${iconId('hover')}`" />
          </svg>
          <span v-if="hasText" class="btn__text-text">{{ title }}</span>
          <slot />
        </span>
        <svg
          v-bind="iconAttrs(icon)"
          class="btn__icon"
          :aria-hidden="hasText ? undefined : 'true'"
        >
          <use :href="`#${iconId(icon)}`" />
        </svg>
        <span v-if="iconPosition === 'left' && (hasText || $slots.default)" class="btn__text">
          <svg
            v-if="isAccent"
            v-bind="iconAttrs('hover')"
            class="btn__hover-accent btn__hover-accent--text"
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            <use :href="`#${iconId('hover')}`" />
          </svg>
          <span v-if="hasText" class="btn__text-text">{{ title }}</span>
          <slot />
        </span>
      </template>
      <template v-else>
        <span class="btn__text">
          <svg
            v-if="isAccent"
            v-bind="iconAttrs('hover')"
            class="btn__hover-accent btn__hover-accent--text"
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            <use :href="`#${iconId('hover')}`" />
          </svg>
          <span v-if="hasText" class="btn__text-text">{{ title }}</span>
          <slot />
        </span>
      </template>
    </span>
  </component>
</template>
