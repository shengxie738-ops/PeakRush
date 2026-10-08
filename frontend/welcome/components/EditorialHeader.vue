<script setup lang="ts">
import { RouterLink } from "vue-router";
import { HEADER } from "@/content/home";
</script>

<template>
  <header class="pr-header">
    <RouterLink class="pr-brand" to="/" aria-label="PeakRush 首页">
      <svg viewBox="0 0 30 30" aria-hidden="true">
        <path d="M2 24 12 5h6l10 19h-8l-5-10-5 10Z" fill="currentColor" />
      </svg>
      <span>PeakRush<span class="pr-brand-dot">®</span></span>
    </RouterLink>
    <nav class="pr-header-nav" aria-label="主导航">
      <RouterLink
        v-for="item in HEADER.nav"
        :key="item.to"
        :to="item.to"
        active-class="is-current"
        >{{ item.label }}</RouterLink
      >
    </nav>
    <div class="pr-header-actions">
      <RouterLink to="/signin">登录</RouterLink>
      <RouterLink to="/signup">注册</RouterLink>
      <a class="pr-header-shop" href="/app/"
        >进入商城 <span aria-hidden="true">↗</span></a
      >
    </div>
  </header>
</template>

<style>
.pr-header {
  position: fixed;
  z-index: 30;
  inset: 0 0 auto;
  height: 80px;
  padding: 0 clamp(32px, 4vw, 80px);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
  background: #f7f7f2;
  border-bottom: 1px solid #dcdcd5;
  color: #1a1a18;
  font-family: Arial, "Microsoft YaHei", sans-serif;
  font-size: 13px;
  line-height: 1.5;
  letter-spacing: 0;
}
.pr-header a {
  color: inherit;
}
.pr-brand {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 25px;
  font-weight: 750;
  letter-spacing: -1.2px;
}
.pr-brand svg {
  width: 29px;
  height: 29px;
  color: #f26532;
}
.pr-brand-dot {
  font-size: 10px;
  vertical-align: top;
  display: inline-block;
  margin: 4px 0 0 3px;
}
.pr-header-nav,
.pr-header-actions {
  display: flex;
  align-items: center;
  gap: clamp(20px, 2vw, 36px);
}
.pr-header-nav a {
  position: relative;
  padding: 29px 0;
  transition: color 0.2s;
}
.pr-header-nav a:hover,
.pr-header-nav .is-current {
  color: #d84919;
}
.pr-header-nav .is-current:after {
  content: "";
  position: absolute;
  bottom: 18px;
  left: 50%;
  width: 4px;
  height: 4px;
  border-radius: 50%;
  background: #f26532;
}
.pr-header-actions {
  gap: 20px;
}
.pr-header .pr-header-shop {
  display: flex;
  gap: 24px;
  padding: 11px 17px;
  background: #1a1a18;
  color: #fff;
}
.pr-header-shop:hover {
  background: #d84919 !important;
}
.pr-header a:focus-visible {
  outline: 2px solid #d84919;
  outline-offset: 6px;
}
</style>
