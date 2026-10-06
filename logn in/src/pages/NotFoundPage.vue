<script setup lang="ts">
/** NotFoundPage — clone-local error page; the reference 404 was not captured, so
 *  this is explicitly not claimed to match it. */
import { RouterLink } from 'vue-router';
import SiteFooter from '@/components/SiteFooter.vue';
</script>

<template>
  <section class="ui-orange" data-section-id="not-found" data-page-header-theme="orange">
    <div class="section error-section">
      <h1 class="display-heading">Page Not Found</h1>
      <RouterLink class="button button--primary" to="/">Go to homepage</RouterLink>
      <p data-evidence="pending-T00-subpage">Clone-local error page; reference 404 not yet captured.</p>
    </div>
  </section>
  <SiteFooter />
</template>
