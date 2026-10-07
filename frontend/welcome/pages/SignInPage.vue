<script setup lang="ts">
/**
 * SignInPage — /signin, rendered from the measured panel (AuthPanel.vue, which
 * cites evidence/reference/signin-measured.md).
 *
 * Local demo only: no request leaves the page and no credential is stored.
 * AuthPanel's form is @submit.prevent with a no-op handler and its OAuth buttons
 * are type="button", so nothing here can reach the network.
 *
 * The notice is one short line on purpose: the measured auth column is 724px
 * tall inside a 772px viewport (signin-measured.md, inner rect [819,48,427,724]),
 * so a two-line banner pushes the page past the fold and adds a scrollbar the
 * reference does not have (its containerScrollHeight is 772).
 */
import AuthPanel from '@/components/AuthPanel.vue';

const NOTICE = 'Local clone demo — nothing you type leaves this page.';
</script>

<template>
  <AuthPanel mode="signin" :notice="NOTICE" />
</template>
