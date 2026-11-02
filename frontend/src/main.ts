import { createApp } from "vue";
import { createRouter, createWebHistory } from "vue-router";
import ElementPlus from "element-plus";
import zhCn from "element-plus/es/locale/lang/zh-cn";
import "element-plus/dist/index.css";
import "./style.css";
import App from "./App.vue";
const router = createRouter({
  history: createWebHistory("/app/"),
  routes: [
    { path: "/", component: () => import("./pages/Storefront.vue") },
    {
      path: "/activities/:id",
      component: () => import("./pages/Storefront.vue"),
    },
    { path: "/orders", component: () => import("./pages/OrdersPage.vue") },
    { path: "/admin", component: () => import("./pages/AdminPage.vue") },
    { path: "/:pathMatch(.*)*", redirect: "/" },
  ],
  scrollBehavior: () => ({ top: 0 }),
});
createApp(App).use(router).use(ElementPlus, { locale: zhCn }).mount("#app");
