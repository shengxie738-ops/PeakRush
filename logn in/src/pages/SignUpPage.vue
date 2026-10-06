<script setup lang="ts">
/**
 * SignUpPage — /signup, rendered from the measured panel (AuthPanel.vue, which
 * cites evidence/reference/signup-measured.md).
 *
 * Step 1 only, because that is all that was measured. Local demo: no account is
 * created, no request leaves the page and nothing is stored.
 *
 * One short line of notice, for the same height-budget reason as SignInPage:
 * signup-measured.md puts the form at [819,134,426.82,552.25] inside a 724px
 * column, and a taller block would push the page past 772px.
 */
import AuthPanel from '@/components/AuthPanel.vue';

const NOTICE = 'Local clone demo — no account is created and nothing is stored.';
</script>

<template>
  <AuthPanel mode="signup" :notice="NOTICE" />
</template>
