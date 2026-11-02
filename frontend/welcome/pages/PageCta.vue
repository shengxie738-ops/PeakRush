<script setup lang="ts">
/**
 * PageCta.vue — CLONE-LOCAL (src/pages/ lane) emit of the reference `Button` DOM,
 * used by the sub-pages so they do not depend on a component another agent owns.
 *
 * Measured markup on /pricing, /our-product and /gift-card:
 *   <a class="not-nuxt-link btn btn--space-between btn--full btn--accent
 *            btn--primary btn--large …" href="/signup" tabindex="0" title="">
 *     <span class="btn__content">
 *       <span class="btn__text">
 *         <svg class="btn__hover-accent btn__hover-accent--text icon icon-hover"/>
 *         <span class="btn__text-text">Join</span>
 *       </span>
 *       <svg class="btn__icon icon icon-step-next"/>
 *     </span>
 *   </a>
 * `variant` is the reference space-separated variant list ("primary large"),
 * turned into `btn--*` classes exactly like the reference `vn()` helper does.
 */
import { computed } from 'vue';
import { RouterLink } from 'vue-router';
import PageIcon from './PageIcon.vue';

const props = withDefaults(
  defineProps<{
    variant?: string;
    label?: string;
    to?: string;
    href?: string;
    external?: boolean;
    icon?: string;
    iconPosition?: 'left' | 'right';
    size?: string;
    textSize?: string;
    ariaLabel?: string;
    title?: string;
    active?: boolean;
    disabled?: boolean;
    asButton?: boolean;
    type?: string;
    extraClass?: string;
  }>(),
  {
    variant: 'primary accent',
    label: '',
    to: '',
    href: '',
    external: false,
    icon: '',
    iconPosition: 'right',
    size: '',
    textSize: '',
    ariaLabel: '',
    title: '',
    active: false,
    disabled: false,
    asButton: false,
    type: '',
    extraClass: '',
  },
);

const emit = defineEmits<{ (e: 'click', payload: MouseEvent): void }>();

const isAnchor = computed(() => Boolean(props.to) && !props.to.startsWith('#'));
const rootElement = computed(() => {
  if (props.asButton || (!isAnchor.value && !props.href)) return 'button';
  return isAnchor.value ? RouterLink : 'a';
});

const rootClass = computed(() => {
  const parts = ['not-nuxt-link', 'btn'];
  if (props.active) parts.push('is-active');
  if (props.disabled) parts.push('is-disabled');
  if (props.icon && props.label) parts.push('btn--space-between');
  if (props.icon && !props.label && !props.variant.includes('square')) parts.push('btn--start');
  for (const token of props.variant.split(' ')) if (token) parts.push(`btn--${token}`);
  if (props.size) parts.push(`btn--${props.size}`);
  if (props.textSize) parts.push(`btn--text-${props.textSize}`);
  if (props.extraClass) parts.push(props.extraClass);
  return parts.join(' ');
});

const isAccent = computed(() => props.variant.split(' ').includes('accent'));

function onClick(event: MouseEvent): void {
  if (props.disabled) event.preventDefault();
  else emit('click', event);
}
</script>

<template>
  <component
    :is="rootElement"
    :class="rootClass"
    :to="isAnchor ? props.to : undefined"
    :href="!isAnchor && props.href ? props.href : undefined"
    :target="props.external ? '_blank' : undefined"
    :rel="props.external ? 'noopener' : undefined"
    :tabindex="props.disabled ? -1 : 0"
    :aria-label="props.ariaLabel || null"
    :title="props.title || ''"
    :type="!isAnchor && props.href ? undefined : props.type || (props.asButton ? 'button' : undefined)"
    :disabled="props.asButton && rootElement === 'button' ? props.disabled : undefined"
    @click="onClick"
  >
    <span class="btn__content">
      <span v-if="props.label" class="btn__text">
        <PageIcon
          v-if="isAccent"
          name="hover"
          extra-class="btn__hover-accent btn__hover-accent--text"
        />
        <span class="btn__text-text">{{ props.label }}</span>
      </span>
      <PageIcon v-if="props.icon && props.iconPosition === 'left'" :name="props.icon" extra-class="btn__icon" />
      <slot v-if="!props.label" />
      <PageIcon v-if="props.icon && props.iconPosition === 'right'" :name="props.icon" extra-class="btn__icon" />
    </span>
  </component>
</template>
