<script setup lang="ts">
/**
 * AccessibleDialog.vue — the reference `Modal`
 * (evidence/reference/raw/_nuxt/Bi84onXO.js, `__name:"Modal"`).
 *
 * Reproduced DOM (verbatim tree from the compiled render function):
 *   <Teleport to="#teleports">
 *     <div class="modal modal--open modal--{variant} ui-{theme}"
 *          aria-label="{title}" aria-modal="true" aria-hidden role="dialog" tabindex="0">
 *       <div class="modal__background ui-background"/>
 *       <div class="modal__wrapper">
 *         <div class="modal__wrapper-header">
 *           <button class="btn btn--link btn--accent modal__wrapper-header-close" …/>
 *           <slot name="header"/>
 *         </div>
 *         <div class="modal__wrapper-scrollable"><slot/></div>
 *         <div class="modal__wrapper-footer" v-if="footer"><slot name="footer"/></div>
 *       </div>
 *     </div>
 *   </Teleport>
 *
 * Open/close contract is the reference's: an <a href="#{id}"> anywhere in the page
 * opens it (document click listener), Escape and a background click close it, and
 * `with-modal` is put on <html> while it is showing. Focus is moved into the dialog
 * and restored to the invoking element on close.
 */
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import BrushLink from './BrushLink.vue';

const props = withDefaults(
  defineProps<{
    id: string;
    title: string;
    theme?: string;
    variant?: string;
    closeLabel?: string;
    /** Close on any route change (reference hideOnRouteNavigation, default true). */
    hideOnRouteNavigation?: boolean;
    /** Close on backdrop / link click (reference autoClose). */
    autoClose?: boolean;
    customHeaderClasses?: string;
  }>(),
  {
    theme: 'light',
    variant: '',
    closeLabel: 'Close',
    hideOnRouteNavigation: true,
    autoClose: true,
    customHeaderClasses: '',
  },
);

const emit = defineEmits<{
  (event: 'show'): void;
  (event: 'hide'): void;
}>();

const open = ref(false);
const container = ref<HTMLElement | null>(null);
let returnFocus: HTMLElement | null = null;

const rootClass = computed(() => {
  const parts = ['modal'];
  if (open.value) parts.push('modal--open');
  if (props.variant) parts.push('modal--' + props.variant);
  parts.push('ui-' + props.theme);
  return parts.join(' ');
});

function show(origin?: HTMLElement): void {
  if (open.value) return;
  returnFocus = origin ?? (document.activeElement as HTMLElement | null);
  open.value = true;
}

function hide(): void {
  if (!open.value) return;
  open.value = false;
  returnFocus?.focus?.();
}

defineExpose({ show, hide, open });

function onDocumentClick(event: MouseEvent): void {
  const path = event.composedPath();
  const anchor = path.find(
    (node): node is HTMLAnchorElement => node instanceof HTMLAnchorElement && node.hasAttribute('href'),
  );
  if (!anchor) return;
  const href = anchor.getAttribute('href') ?? '';
  if (href === '#' + props.id || href === window.location.pathname + '#' + props.id) {
    event.preventDefault();
    show(anchor);
  }
}

function onKeydown(event: KeyboardEvent): void {
  if (props.autoClose && event.key === 'Escape') {
    event.preventDefault();
    hide();
  }
}

function onBackdropClick(): void {
  if (props.autoClose) hide();
}

function onWrapperClick(event: MouseEvent): void {
  if (!props.autoClose) return;
  const target = event.target as HTMLElement | null;
  if (target?.closest('.js-modal-no-autoclose')) return;
  const link = event
    .composedPath()
    .find((node): node is HTMLAnchorElement => node instanceof HTMLAnchorElement);
  if (link) {
    const href = link.getAttribute('href') ?? '';
    if (href.startsWith('#') || href.startsWith(window.location.pathname + '#')) return;
  }
  hide();
}

watch(open, (value) => {
  document.documentElement.classList.toggle('with-modal', value);
  if (value) {
    emit('show');
    window.requestAnimationFrame(() => container.value?.focus?.());
  } else {
    emit('hide');
  }
});

/* close on navigation, like the reference hideOnRouteNavigation */
watch(
  () => window.location.pathname,
  () => {
    if (props.hideOnRouteNavigation) hide();
  },
);

onMounted(() => document.addEventListener('click', onDocumentClick));
onBeforeUnmount(() => {
  document.removeEventListener('click', onDocumentClick);
  document.documentElement.classList.remove('with-modal');
});
</script>

<template>
  <Teleport to="#teleports" defer>
    <div
      v-if="open"
      ref="container"
      :class="rootClass"
      :aria-label="title"
      aria-modal="true"
      :aria-hidden="!open"
      role="dialog"
      tabindex="0"
      @keydown="onKeydown"
      @click="onWrapperClick"
    >
      <div class="modal__background ui-background" @click.stop="onBackdropClick" />
      <div class="modal__wrapper">
        <div :class="['modal__wrapper-header', customHeaderClasses]">
          <slot name="close">
            <BrushLink
              class="modal__wrapper-header-close"
              variant="link accent"
              icon="close"
              :aria-label="closeLabel"
              @click="hide"
            />
          </slot>
          <slot name="header" />
        </div>
        <div class="modal__wrapper-scrollable">
          <slot />
        </div>
        <div v-if="$slots.footer" class="modal__wrapper-footer">
          <slot name="footer" />
        </div>
      </div>
    </div>
  </Teleport>
</template>
