<script setup lang="ts">
import { RouterLink } from "vue-router";
import "@/styles/editorial.css";
defineProps<{ label: string; index: string; english: string }>();
</script>

<template>
  <article class="pr-editorial">
    <div class="pr-page-meta pr-wrap">
      <span
        ><RouterLink to="/">PEAKRUSH</RouterLink
        ><span class="pr-meta-slash">/</span>{{ label }}</span
      ><span
        >{{ english }} <span class="pr-meta-slash">/</span> {{ index }}</span
      >
    </div>
    <slot />
    <footer class="pr-footer">
      <div class="pr-wrap">
        <div class="pr-footer-top">
          <div>
            <p class="pr-eyebrow">GOOD THINGS. RIGHT ON TIME.</p>
            <h2>让好物与热爱，<br />准点相遇。</h2>
          </div>
          <a class="pr-footer-cta" href="/app/" aria-label="进入商城发现好物"
            ><span>发现你的下一件好物</span
            ><span aria-hidden="true">↗</span></a
          >
        </div>
        <div class="pr-footer-bottom">
          <RouterLink class="pr-footer-brand" to="/">PeakRush®</RouterLink>
          <nav aria-label="页脚导航">
            <RouterLink to="/our-product">抢购指南</RouterLink
            ><RouterLink to="/faq">常见问题</RouterLink
            ><RouterLink to="/terms-and-conditions">平台使用规则</RouterLink
            ><RouterLink to="/privacy-policy">隐私说明</RouterLink
            ><RouterLink to="/cookies-policy">存储说明</RouterLink>
          </nav>
          <span>© {{ new Date().getFullYear() }} PeakRush</span>
        </div>
      </div>
    </footer>
  </article>
</template>
