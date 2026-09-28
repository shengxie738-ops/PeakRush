<script setup lang="ts">
import { onMounted } from "vue";
import { ArrowDown, User, SwitchButton } from "@element-plus/icons-vue";
import { useRouter } from "vue-router";
import { session, logout, requireLogin, restoreSession } from "./session";
import AuthDialog from "./components/AuthDialog.vue";
const router = useRouter();
function command(value: string) {
  if (value === "logout") {
    logout();
    router.push("/");
  } else router.push(value);
}
onMounted(restoreSession);
</script>
<template>
  <a class="skip-link" href="#main">跳转到主要内容</a>
  <header class="site-header">
    <RouterLink to="/" class="brand" aria-label="PeakRush 首页"
      ><span class="wordmark">Peak<span>Rush</span></span
      ><span class="brand-caption">限量抢购</span></RouterLink
    >
    <nav class="primary-nav" aria-label="主导航">
      <RouterLink
        to="/"
        :class="{
          active: $route.path === '/' || $route.path.startsWith('/activities'),
        }"
        >限时抢购</RouterLink
      ><RouterLink to="/orders" active-class="active">我的订单</RouterLink
      ><RouterLink
        v-if="session.user?.role === 'ADMIN'"
        to="/admin"
        active-class="active"
        >管理工作台</RouterLink
      >
    </nav>
    <div class="account">
      <el-dropdown v-if="session.user" trigger="click" @command="command"
        ><button class="account-button" aria-label="打开账号菜单">
          <span class="avatar"
            ><el-icon><User /></el-icon></span
          ><span class="account-copy"
            ><strong>{{ session.user.username }}</strong
            ><small>做生活的先享者</small></span
          ><el-icon class="chevron"><ArrowDown /></el-icon></button
        ><template #dropdown
          ><el-dropdown-menu
            ><el-dropdown-item command="/orders">我的订单</el-dropdown-item
            ><el-dropdown-item
              v-if="session.user.role === 'ADMIN'"
              command="/admin"
              >管理工作台</el-dropdown-item
            ><el-dropdown-item divided command="logout" :icon="SwitchButton"
              >退出登录</el-dropdown-item
            ></el-dropdown-menu
          ></template
        ></el-dropdown
      ><button v-else class="login-link" @click="requireLogin()">
        <el-icon><User /></el-icon>登录 / 注册
      </button>
    </div>
  </header>
  <main id="main" tabindex="-1"><RouterView /></main>
  <footer class="site-footer">
    <p><strong>PeakRush</strong> 让好物与热爱，准点相遇。</p>
    <p>每一次开抢，都是生活的新起点。</p>
  </footer>
  <AuthDialog />
</template>
