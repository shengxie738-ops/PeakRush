<script setup lang="ts">
// Keep the existing split layout while using the PeakRush account API.
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue';
import { RouterLink, useRoute } from 'vue-router';
import DisplayHeading from '@/components/DisplayHeading.vue';
import { safeRedirect } from '@shared/safe-redirect';
import { submitAuth, AuthRequestError } from '@/app/authApi';
import { validateCredentials, type FieldErrors, type FieldName } from '@/app/auth-validation';
import { AUTH_SPLIT, FORM_TABS, SIGNIN_COPY, SIGNIN_FIELDS, SIGNUP_STEP1 } from '@/content/subpages/auth';

interface AuthField {
  name: FieldName;
  type: string;
  label: string;
  required: boolean;
  autocomplete: string;
  reveal: boolean;
}

const props = defineProps<{ mode: 'signin' | 'signup' }>();
const route = useRoute();
const isSignIn = computed(() => props.mode === 'signin');
const panelTheme = computed(() => (isSignIn.value ? 'ui-green' : 'ui-orange'));
const headerTheme = computed(() => (isSignIn.value ? 'light' : 'orange'));
const tagline = computed(() => (isSignIn.value ? AUTH_SPLIT.lines : AUTH_SPLIT.signupLines).join('\n'));
const redirectTarget = computed(() => safeRedirect(route.query.redirect));
const tabs = computed(() => FORM_TABS.items.map(tab => ({
  label: tab.label,
  to: { path: tab.to, query: { redirect: redirectTarget.value } },
  active: (tab.to === '/signin') === isSignIn.value,
})));
const fields = computed<AuthField[]>(() => {
  const base: AuthField[] = (isSignIn.value ? SIGNIN_FIELDS : SIGNUP_STEP1.fields)
    .map(field => ({ ...field, reveal: field.type === 'password' }));
  if (!isSignIn.value) base.push({ name: 'confirm', type: 'password', label: '确认密码', required: true, autocomplete: 'new-password', reveal: true });
  return base;
});
const form = reactive<Record<FieldName, string>>({ username: '', password: '', confirm: '' });
const revealed = reactive<Record<FieldName, boolean>>({ username: false, password: false, confirm: false });
const errors = ref<FieldErrors>({});
const busy = ref(false);
const serverError = ref('');
const guidance = ref('');
let disposed = false;
onBeforeUnmount(() => { disposed = true; });
onMounted(() => {
  try {
    guidance.value = sessionStorage.getItem('peakrush.authMessage') || '';
    sessionStorage.removeItem('peakrush.authMessage');
  } catch { /* The form is usable even when session storage is disabled. */ }
  if (!guidance.value && route.query.reason === 'expired') guidance.value = '登录已过期，请重新登录后继续。';
});
const submitLabel = computed(() => busy.value
  ? (isSignIn.value ? '登录中…' : '注册中…')
  : (isSignIn.value ? SIGNIN_COPY.submit : SIGNUP_STEP1.submit));
const submitClass = ['btn', 'btn--space-between', 'btn--primary', 'btn--accent', 'btn--full', 'btn--block', 'btn--smallish'];

async function submit(): Promise<void> {
  if (busy.value) return;
  serverError.value = '';
  errors.value = validateCredentials(form, props.mode);
  if (Object.keys(errors.value).length) return;
  const target = redirectTarget.value;
  busy.value = true;
  try {
    const result = await submitAuth(props.mode, form.username, form.password);
    if (disposed) return;
    localStorage.setItem('peakrush.user', JSON.stringify(result.user));
    localStorage.setItem('peakrush.token', result.token);
    window.location.assign(target);
  } catch (error) {
    if (!disposed) serverError.value = error instanceof AuthRequestError
      ? error.message : '暂时无法完成操作，请重试。';
  } finally {
    if (!disposed) busy.value = false;
  }
}
</script>

<template>
  <section class="auth-page layout-split-page" :data-section-id="props.mode" :data-page-header-theme="headerTheme">
    <div class="layout-split row layout-split--mobile-background">
      <div class="layout-split__bg col col--6:md" :class="[panelTheme, 'ui-background']">
        <DisplayHeading is="h1" :title="AUTH_SPLIT.heading" :svg-key="props.mode === 'signin' ? 'signin-wordmark' : 'signup-wordmark'" visual-class="layout-split__word" />
        <p class="layout-split__tagline text-card-h1 text-box-trim">{{ tagline }}</p>
      </div>
      <div class="layout-split__overlay-container col col--6:md ui-light ui-light-background">
        <div class="layout-split__content">
          <div class="section">
            <div class="section__layer">
              <div class="row row--gx px-1">
                <div class="col col--12 mx-auto:md layout-split__side layout-split-stretch pt-header:md">
                  <div class="pb-2 pt-0.75 py-4.5:md layout-split-stretch auth-column">
                    <div class="auth-tabs">
                      <div v-for="tab in tabs" :key="tab.to.path" class="auth-tabs__item" :class="{ 'is-active': tab.active }">
                        <h2 v-if="tab.active" class="text-card-h1 text-box-trim text-nowrap auth-tabs__active">{{ tab.label }}</h2>
                        <RouterLink v-else class="btn btn--link btn--link--small btn--full btn--text-card-h1 auth-tabs__inactive" :class="tab.to.path === '/signin' ? 'btn--text-right' : 'btn--text-left'" :to="tab.to">
                          <span class="btn__content"><span class="btn__text"><span class="btn__text-text">{{ tab.label }}</span></span></span>
                        </RouterLink>
                      </div>
                    </div>
                    <div class="auth-oauth" aria-hidden="true" />
                    <p class="auth-or">{{ isSignIn ? SIGNIN_COPY.orEmail : SIGNUP_STEP1.orEmail }}</p>
                    <p v-if="guidance" class="auth-demo-notice" role="status">{{ guidance }}</p>
                    <form class="auth-form" novalidate :aria-busy="busy" @submit.prevent="submit">
                      <template v-for="field in fields" :key="field.name">
                        <div class="input-text is-with-label input--base" :class="{ 'is-empty': !form[field.name], 'has-error': errors[field.name] }">
                          <label :for="'auth-' + mode + '-' + field.name" class="form-label form-label--floating input-text__label">
                            {{ field.label }} <span v-if="field.required" class="text-color-error">*</span>
                          </label>
                          <div class="input-text__group">
                            <input :id="'auth-' + mode + '-' + field.name" v-model="form[field.name]" class="input-text__group-input" :class="{ 'input-text__group-input--password': field.reveal }" :type="field.reveal && revealed[field.name] ? 'text' : field.type" :name="field.name" :autocomplete="field.autocomplete" :required="field.required" :disabled="busy" :aria-invalid="Boolean(errors[field.name])" :aria-describedby="errors[field.name] ? 'auth-error-' + field.name : undefined" @input="errors[field.name] = undefined">
                            <button v-if="field.reveal" class="btn btn--start btn--link btn--link--heading auth-reveal" type="button" :aria-label="(revealed[field.name] ? '隐藏' : '显示') + field.label" :aria-pressed="revealed[field.name]" :disabled="busy" @click="revealed[field.name] = !revealed[field.name]">
                              <span class="btn__content"><svg class="btn__icon" viewBox="0 0 18 18" aria-hidden="true"><circle cx="9" cy="9" r="8.1" fill="none" stroke="currentColor" stroke-width="1.6" /><path d="M3.5 9c1.6-2.3 3.4-3.4 5.5-3.4S12.9 6.7 14.5 9c-1.6 2.3-3.4 3.4-5.5 3.4S5.1 11.3 3.5 9Z" fill="none" stroke="currentColor" stroke-width="1.3" /><circle cx="9" cy="9" r="1.9" fill="currentColor" /></svg></span>
                            </button>
                          </div>
                        </div>
                        <ul :id="'auth-error-' + field.name" class="error-list transition-height" :class="{ 'auth-field-error': errors[field.name] }" aria-live="polite"><li v-if="errors[field.name]">{{ errors[field.name] }}</li></ul>
                      </template>
                      <p v-if="serverError" class="auth-server-error" role="alert">{{ serverError }}</p>
                      <div class="row row--gx auth-submit">
                        <div class="col col--6">
                          <button :class="submitClass" type="submit" :disabled="busy">
                            <span class="btn__content"><span class="btn__text"><span class="btn__text-text">{{ submitLabel }}</span></span><svg class="btn__icon auth-submit__icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="11" fill="none" stroke="currentColor" /><path d="M8 12h8M13 8l4 4-4 4" fill="none" stroke="currentColor" /></svg></span>
                          </button>
                        </div>
                        <div class="col col--6" />
                      </div>
                      <p class="auth-demo-notice">{{ isSignIn ? '登录后，继续你的抢购之旅。' : '创建账号，让心动好物准点相遇。' }}</p>
                      <a href="/app/" class="auth-business-link">进入商城 →</a>
                    </form>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div class="layout-split__footer" />
      </div>
    </div>
  </section>
</template>
<style>
/* ==========================================================================
   Auth panel CSS. Either (a) a reference class the measurement names but that
   has NO rule anywhere in src/styles/*.css — the auth route chunk was never
   downloadable (Cloudflare), so `.input-text`, `.form-label`, `.error-list`,
   `.input-checkbox`, `.layout-split*` and the four utilities below are absent
   from the transcribed sheets — or (b) a clone-local `.auth-*` helper.
   Values are quoted from evidence/reference/{signin,signup}-measured.md; the
   colours all resolve through tokens that DO already exist (tokens.css ships
   --c-black-15 = the measured rgba(0,0,0,.15) border, --c-black-60 = the
   measured label colour, --c-error = rgb(234,27,79), --c-grey = rgb(156,156,156),
   and the whole --t-input_base_* family), so none of them is restated here.
   Unlayered on purpose: the button primitives live in @layer overrides and the
   tab / submit geometry has to beat them.
   ========================================================================== */

/* ---- utilities the measurement names but layout.css never received ------- */
.mx-auto\:md {
  margin-left: auto;
  margin-right: auto;
}
.pt-header\:md {
  padding-top: var(--md, var(--spacing-header)) var(--n-md, 0);
}
.pt-0\.75 {
  padding-top: calc(var(--spacing) * 0.75);
}
.py-4\.5\:md {
  padding-bottom: var(--md, calc(var(--spacing) * 4.5)) var(--n-md, 0);
  padding-top: var(--md, calc(var(--spacing) * 4.5)) var(--n-md, 0);
}

/* ---- the split ---------------------------------------------------------- */
/* Measured: the outer .layout-split row is 1376 wide and splits into two 688px
   halves with NO gutter (688 = 1376/2 exactly, which only holds while
   --grid-gx is 0); the gutter lives on the INNER row.row--gx.px-1. */
.layout-split {
  min-height: 100svh;
}
.layout-split__bg {
  display: flex;
  flex-direction: column;
  margin-top: var(--spacing-header);
  min-height: calc(100svh - var(--spacing-header));
  padding: var(--spacing);
  padding-top: 0;
  position: relative;
}
/* The reference's auth bar is the short `.header` (--spacing-header = 47.77px,
   which is also exactly where the panel's green starts in V21: y=48.67), not the
   76.44px `.promo-header`. Letting it stop painting is what puts the panel's top
   edge back at 47.77 instead of under the bar. */
body:has(.layout-split-page) .promo-header,
body:has(.layout-split-page) .promo-header__previous-bg {
  background: none;
}
/* The glyph set is shared with the home hero, which parks .intro__title off
   screen until .intro--show lands. The auth panel has no reveal state to wait
   for, so the transform is pinned to its end value. */
.layout-split__bg .intro__title {
  position: relative;
  top: 0;
  transform: none;
}
/* The captured inline SVG carries fill="white" (it is the home hero's, on
   orange). On both auth frames the word reads rgb(0,0,0) — sampled at (50,100)
   in V21 — and a presentation attribute loses to any CSS fill. */
.layout-split__bg .title path {
  fill: var(--c-black);
}
/* Bottom-left of the panel, white, .text-card-h1 (38.9335px). */
.layout-split__tagline {
  color: var(--c-white);
  margin-top: auto;
  white-space: pre-line;
}
.layout-split__overlay-container {
  display: flex;
  flex-direction: column;
  min-height: 100svh;
}
.layout-split__content {
  display: flex;
  flex: 1;
}
.layout-split__content > .section {
  flex: 1;
}
.layout-split-stretch {
  display: flex;
  flex-direction: column;
}
/* Measured column [819,0,427,772] inside a 649.78px row content box: 426.82 is
   exactly 8 of the 12 grid columns (36.63094*8 + 19.1099*7 = 426.817), centred
   in the half by mx-auto:md. That is what .layout-split__side adds on top of
   .col--12. It has to go through --grid-col-size rather than override `width`:
   .col is a flex item of .row, so its used inline size comes from
   flex-basis:var(--grid-col-width), which only --grid-col-size feeds. */
.layout-split__side {
  --grid-col-size: 8;
  max-width: 100%;
  position: relative;
}
.auth-column {
  max-width: 100%;
}

/* ---- tabs --------------------------------------------------------------- */
/* Slots are 213.07 + 213.08 = the column, no gutter. The underline sits at
   y=182 and is rgb(217,217,217) — i.e. --t-line, rgba(0,0,0,.15) over white —
   on the inactive side and black on the active side, sampled from both frames. */
.auth-tabs {
  display: flex;
}
.auth-tabs__item {
  border-bottom: 1px solid var(--t-line);
  flex: 1 1 50%;
}
.auth-tabs__item.is-active {
  border-bottom-color: var(--c-black);
}
/* Each slot hugs the outer edge: the reference's active h2 computes
   text-align:right in the right slot (V21 "Login" ends at x=1243) and the left
   slot's word starts at x=832 on both routes. The inactive <a> does the same via
   btn--text-left / btn--text-right on its .btn__content. */
.auth-tabs__item:first-child .auth-tabs__active {
  text-align: left;
}
.auth-tabs__item:last-child .auth-tabs__active {
  text-align: right;
}
/* Measured 48.01px = the 28.91px trimmed text box + var(--spacing) beneath it.
   The trim itself comes free: .btn__text is already trimmed against the
   --lh/--fos/--foe that .btn--text-card-h1 sets. */
.auth-tabs__inactive {
  padding-bottom: var(--spacing);
}

/* ---- OAuth row ---------------------------------------------------------- */
/* 208.64 + 9.555 + 208.64 = 426.82 */
.auth-oauth {
  display: flex;
  gap: calc(var(--scale-px) * 10);
  margin-top: calc(var(--scale-px) * 60);
}

/* ---- "or login with e-mail" -------------------------------------------- */
/* The measurement gives the string but no size. Its ink run in the frozen
   frames — 819..925 on /signin, 819..918 on /signup — is 0.85 of what the
   12.6534px UI scale produces for the same string in HeadingNow, which puts it
   one step down at 1.1 --scale-text-rem (10.71px). */
.auth-or {
  color: var(--t-small);
  font-family: HeadingNow, Helvetica, Arial, sans-serif;
  font-size: calc(var(--scale-text-rem) * 1.1);
  letter-spacing: -0.02em;
  line-height: calc(var(--scale-text-rem) * 2);
  margin-top: calc(var(--scale-px) * 34);
}

/* ---- fields ------------------------------------------------------------- */
/* Token indirection, transcribed verbatim from evidence/reference/raw/_nuxt/
   entry.D4FdtiYZ.css. It is the only place the --t-input_base_* / --t-input_checkbox_*
   families in tokens.css reach the --input-* names the component rules consume,
   and it was never lifted into src/styles/*.css because the auth route chunk
   that carries the component rules could not be downloaded. */
.input--base {
  --input-label: var(--t-input_base_label);
  --input-background: var(--t-input_base_background);
  --input-color: var(--t-input_base_color);
  --input-border: var(--t-input_base_border);
  --input-placeholder: var(--t-input_base_placeholder);
  --input-empty-label: var(--t-input_base_empty-label);
  --input-empty-border: var(--t-input_base_empty-border);
  --input-hovered-color: var(--t-input_base_hovered-color);
  --input-hovered-border: var(--t-input_base_hovered-border);
  --input-focused-color: var(--t-input_base_focused-color);
  --input-focused-border: var(--t-input_base_focused-border);
  --input-disabled-label: var(--t-input_base_disabled-label);
  --input-disabled-color: var(--t-input_base_disabled-color);
  --input-disabled-border: var(--t-input_base_disabled-border);
  --input-error-label: var(--t-input_base_error-label);
  --input-error-border: var(--t-input_base_error-border);
  --input-error-empty-label: var(--t-input_base_error-empty-label);
  --input-error-hovered-label: var(--t-input_base_error-hovered-label);
}
.input--checkbox {
  --input-label: var(--t-input_checkbox_label);
  --input-border: var(--t-input_checkbox_border);
  --input-accent: var(--t-input_checkbox_accent);
  --input-hovered-label: var(--t-input_checkbox_hovered-label);
  --input-hovered-border: var(--t-input_checkbox_hovered-border);
  --input-focused-border: var(--t-input_checkbox_focused-border);
  --input-active-background: var(--t-input_checkbox_active-background);
  --input-active-hovered-border: var(--t-input_checkbox_active-hovered-border);
  --input-active-focused-border: var(--t-input_checkbox_active-focused-border);
  --input-disabled-label: var(--t-input_checkbox_disabled-label);
  --input-disabled-border: var(--t-input_checkbox_disabled-border);
  --input-active-disabled-label: var(--t-input_checkbox_active-disabled-label);
  --input-active-disabled-accent: var(--t-input_checkbox_active-disabled-accent);
  --input-error-border: var(--t-input_checkbox_error-border);
}
.auth-form {
  margin-top: calc(var(--scale-px) * 14);
}
/* Measured wrapper height 55.2px ([819,334,426.82,55.2]); the .input-text__group
   inside it is 56.75px and overflows by its own borders, exactly as measured.
   The wrapper, not the group, is what the .error-list is laid out after. */
.input-text {
  height: calc(var(--scale-px) * 57.8);
  position: relative;
}
.input-text__group {
  border: 1px solid var(--input-empty-border);
  display: flex;
  position: relative;
}
/* Measured input [819,334,425.49,55.42] = 58 * --scale-px. The group is that
   plus two 1px borders, which Chrome snaps to 0.666667px at dpr 1.5 — hence the
   reported 56.75px. */
.input-text__group-input {
  background: transparent;
  border: 0;
  color: var(--input-color, var(--t-heading));
  font-family: HeadingNow, Helvetica, Arial, sans-serif;
  font-size: calc(var(--scale-text-rem) * 1.3);
  height: calc(var(--scale-px) * 58);
  letter-spacing: -0.02em;
  line-height: calc(var(--scale-text-rem) * 2);
  padding: var(--spacing) var(--spacing) 0;
  width: 100%;
}
/* MEASURED ODDITY, reproduced rather than "fixed": the password field genuinely
   computes font-family "Noto Sans SC" at 20px while the email beside it computes
   HeadingNow 12.6534px. The fixed 58-unit height keeps both boxes identical. */
.input-text__group-input--password {
  font-family: 'Noto Sans SC';
  font-size: 20px;
}
/* 12.6534px rgba(0,0,0,.6), padding 19.1099px 19.1099px 0 — the label floats
   over the input rather than sitting above it. */
.input-text__label {
  color: var(--input-empty-label, var(--c-black-60));
  font-family: HeadingNow, Helvetica, Arial, sans-serif;
  font-size: calc(var(--scale-text-rem) * 1.3);
  height: calc(var(--scale-px) * 58);
  left: 0;
  letter-spacing: -0.02em;
  line-height: calc(var(--scale-text-rem) * 2);
  padding: var(--spacing) var(--spacing) 0;
  pointer-events: none;
  position: absolute;
  top: 0;
  z-index: 1;
}
.auth-form .input-text:not(.is-empty) .input-text__label,
.auth-form .input-text:focus-within .input-text__label {
  height: auto;
  padding-top: calc(var(--spacing) * .3);
  font-size: calc(var(--scale-text-rem) * 1);
}
.auth-form .input-text__group-input--password {
  padding-right: calc(var(--spacing) * 3);
}
.auth-form .has-error .input-text__group {
  border-color: var(--c-error);
}
/* Measured 10.7067px total with 9.55494px of padding-top. Empty on both routes;
   kept because it reserves the gap before the next field. */
.error-list {
  height: calc(var(--scale-text-rem) * 1.1);
  list-style: none;
  margin: 0;
  padding: calc(var(--scale-px) * 10) 0 0;
}
.auth-form .auth-field-error {
  height: auto;
  min-height: calc(var(--scale-text-rem) * 1.1);
  padding: calc(var(--scale-px) * 10) 0;
  color: var(--c-error);
  font-size: calc(var(--scale-text-rem) * 1.3);
  line-height: 1.4;
}
.auth-server-error {
  color: var(--c-error);
  font-size: calc(var(--scale-text-rem) * 1.3);
  line-height: 1.4;
  margin-top: var(--spacing);
}
.auth-form button:disabled { cursor: wait; opacity: .6; }
.auth-business-link {
  color: var(--t-text);
  display: inline-block;
  font-size: calc(var(--scale-text-rem) * 1.3);
  line-height: 1.4;
  margin-top: var(--spacing);
  text-decoration: underline;
}

/* ---- password reveal ---------------------------------------------------- */
.auth-reveal {
  color: var(--btn-text);
  height: calc(var(--scale-px) * 18);
  position: absolute;
  right: calc(var(--scale-px) * 19);
  top: 50%;
  transform: translateY(-50%);
  width: calc(var(--scale-px) * 18);
}
.auth-reveal .btn__content {
  height: 100%;
  padding: 0;
}
.auth-reveal .btn__icon {
  height: 100%;
  width: 100%;
}

/* ---- checkboxes -------------------------------------------------------- */
/* Both checkbox inputs are sr-only 1x1 and the visible box is the sibling, so
   the label owns the hit area. Box = 16 --scale-px = 15.29px with a 1px border.
   Measured label heights: /signin "Remember me" [819,473,426.82,15.28] and
   /signup newsletter [819,525,426.82,15.28] — i.e. the label box IS the 16-unit
   checkbox — while the consent row is 19.47px because its two inline links carry
   a 19.4668px line box. */
.form-label--with-input {
  align-items: flex-start;
  color: var(--t-text);
  cursor: pointer;
  display: flex;
  font-family: HeadingNow, Helvetica, Arial, sans-serif;
  font-size: calc(var(--scale-text-rem) * 1.3);
  letter-spacing: -0.02em;
  line-height: calc(var(--scale-px) * 16);
  position: relative;
}
.input-checkbox__box {
  border: 1px solid var(--input-border, var(--t-heading));
  flex: 0 0 auto;
  height: calc(var(--scale-px) * 16);
  margin-right: calc(var(--scale-px) * 10);
  width: calc(var(--scale-px) * 16);
}
.auth-remember {
  margin-top: calc(var(--scale-px) * 7);
}
.auth-consent--terms {
  line-height: calc(var(--scale-text-rem) * 2);
  margin-top: calc(var(--scale-px) * 27);
}
.auth-consent--terms .input-checkbox__box {
  margin-top: calc(var(--scale-px) * 2);
}
.auth-consent--news {
  margin-top: calc(var(--scale-px) * 15);
}
/* Measured [933,498,141.51,9.4] / [1106,498,87.47,9.4]: the 9.4px box is what a
   trimmed .btn__text produces at 12.6534px over a 19.4668px line, and the
   underline lands 3.8px lower via .btn--link--underline's .3em offset. */
.auth-consent__link {
  color: var(--btn-text);
  display: inline-flex;
  font-size: inherit;
  height: auto;
  letter-spacing: inherit;
  line-height: inherit;
  padding: 0;
  vertical-align: baseline;
}
.auth-consent__link .btn__content {
  height: auto;
  justify-content: flex-start;
  min-width: 0;
  padding: 0;
}
.auth-consent__link .btn__text {
  --lh: calc(var(--scale-text-rem) * 2);
}

/* ---- /signin extras ---------------------------------------------------- */
/* Measured [819,526,163.33,17.2], 12.6534px, rgb(156,156,156), lh 19.4668. */
.auth-forgot {
  color: var(--t-small);
  height: calc(var(--scale-px) * 18);
  margin-top: calc(var(--scale-px) * 40);
}
.auth-forgot .btn__content {
  gap: calc(var(--scale-px) * 5);
  height: 100%;
  justify-content: flex-start;
  padding: 0;
}
.auth-forgot .btn__icon {
  height: calc(var(--scale-px) * 18);
  width: calc(var(--scale-px) * 18);
}
.auth-forgot .btn__text {
  font-size: calc(var(--scale-text-rem) * 1.3);
  letter-spacing: -0.02em;
  line-height: calc(var(--scale-text-rem) * 2);
}

/* ---- submit ------------------------------------------------------------ */
/* Measured 203.85 x 28.66 on BOTH routes. 203.86 is exactly a 6/12 column of the
   426.82px auth column at the standard gutter, so the button is a full-width
   child of a .col--6. No height here: btn--smallish produces it. */
.auth-submit {
  margin-top: calc(var(--scale-px) * 59);
}
.auth-submit .btn__text {
  font-size: calc(var(--scale-text-rem) * 1.6);
  letter-spacing: -0.03em;
  line-height: calc(var(--scale-text-rem) * 2);
}
.auth-submit__icon {
  height: calc(var(--scale-px) * 24);
  width: calc(var(--scale-px) * 24);
}

/* CLONE-LOCAL: there is no such line in the reference. It reuses the system's
   own small-text scale and muted colour so the notice reads as part of the
   design rather than as a debug banner. */
.auth-demo-notice {
  color: var(--t-small);
  font-family: HeadingNow, Helvetica, Arial, sans-serif;
  font-size: calc(var(--scale-text-rem) * 1.3);
  letter-spacing: -0.02em;
  line-height: calc(var(--scale-text-rem) * 2);
  margin-top: calc(var(--scale-px) * 4);
}

/* ---- route chrome the two frames do not contain ------------------------ */
/* Both reference frames are empty at [1150,676,207,76], where the fixed "Join"
   button sits on every other route. Scoped with :has() so no shared component
   has to grow a mode prop. */
body:has(.layout-split-page) .fixed-sign-up-button {
  display: none;
}
</style>
