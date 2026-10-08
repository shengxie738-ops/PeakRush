<script setup lang="ts">
/** NotFoundPage — clone-local error page; the reference 404 was not captured, so
 *  this is explicitly not claimed to match it. */
import { RouterLink } from 'vue-router';
import SiteFooter from '@/components/SiteFooter.vue';
</script>

<template>
  <section class="ui-orange" data-section-id="not-found" data-page-header-theme="orange">
    <div class="section error-section">
      <h1 class="display-heading">页面未找到</h1>
      <RouterLink class="button button--primary" to="/">返回首页</RouterLink>
      <p>这个页面暂时找不到，回到首页发现心动好物。</p>
    </div>
  </section>
  <SiteFooter />
</template>
