<script setup lang="ts">
/**
 * CookieConsent.vue — the reference `CookieMessage` (Bi84onXO.js), teleported into
 * `#teleports` and measured live in reference-lock.json
 * ("capture state cookie-message-active", --cookie-message-height = 60 * --scale-px).
 *
 *   <div class="cookie-message ui-light" role="dialog" aria-label="Cookie consent">
 *     <div class="cookie-message__layout ui-background">
 *       <p class="text-smaller text-color-small cookie-message__text">
 *         <span class="text-box-trim">This website uses</span> <a class="btn …">cookies</a>
 *       </p>
 *       <div class="cookie-message__layout-buttons">Deny · Accept</div>
 *
 * The reference's `cookieConsentStatus` cookie is kept (it is a consent flag, not a
 * credential). The banner uses PeakRush's storage copy; no tracking services are
 * attached to this preference.
 */
import { onMounted, ref, watch } from 'vue';
import BrushLink from './BrushLink.vue';
import { COOKIE } from '@/content/home';

const COOKIE_NAME = 'cookieConsentStatus';
const visible = ref(false);

function readConsent(): string | null {
  const match = new RegExp(COOKIE_NAME + '=([01])').exec(document.cookie);
  return match ? match[1] : null;
}

function decide(accepted: boolean): void {
  const expires = new Date();
  expires.setFullYear(expires.getFullYear() + 10);
  document.cookie = COOKIE_NAME + '=' + (accepted ? '1' : '0') + '; expires=' + expires.toUTCString() + '; path=/';
  visible.value = false;
}

onMounted(() => {
  const current = readConsent();
  visible.value = current === null;
});

/* body class drives --cookie-message-height, which the sections reserve space with */
function syncBodyClass(value: boolean): void {
  document.body.classList.toggle('cookie-message-active', value);
}

defineExpose({ visible });
watch(visible, syncBodyClass);
</script>

<template>
  <Teleport to="#teleports" defer>
    <div v-if="visible" class="cookie-message ui-light" role="dialog" :aria-label="COOKIE.dialogLabel">
      <div class="cookie-message__layout ui-background">
        <p class="text-smaller text-color-small cookie-message__text">
          <span class="text-box-trim">{{ COOKIE.text }}</span>
          <BrushLink
            variant="link link--heading accent"
            text-size="smaller"
            :title="COOKIE.link"
            :to="COOKIE.linkTo"
          />
        </p>
        <div class="cookie-message__layout-buttons">
          <BrushLink
            variant="outline small accent"
            text-size="smaller"
            :title="COOKIE.deny"
            as-button
            @click="decide(false)"
          />
          <BrushLink
            variant="outline small accent"
            text-size="smaller"
            :title="COOKIE.accept"
            as-button
            @click="decide(true)"
          />
        </div>
      </div>
    </div>
  </Teleport>
</template>
