<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { Refresh, ShoppingBag } from "@element-plus/icons-vue";
import { ElMessage, ElMessageBox } from "element-plus";
import { api, post, errorMessage } from "../api";
import { session, requireLogin } from "../session";
import { money, dateTime, orderLabel, productImage } from "../format";
import type { Order, ListResponse } from "../types";
const route = useRoute(),
  router = useRouter(),
  orders = ref<Order[]>([]),
  loading = ref(false),
  error = ref(""),
  filter = ref("ALL"),
  detail = ref<Order | null>(null),
  detailOpen = ref(false),
  actionBusy = ref(false),
  now = ref(Date.now());
let timer: number;
let loadGeneration = 0;
const filtered = computed(() =>
  filter.value === "ALL"
    ? orders.value
    : orders.value.filter((o) => o.status === filter.value),
);
function remaining(o: Order) {
  const n = Math.max(
    0,
    Math.floor((new Date(o.expireTime).getTime() - now.value) / 1000),
  );
  return n > 0
    ? Math.floor(n / 60) + " 分 " + (n % 60) + " 秒"
    : "订单已到期，等待关闭";
}
async function load() {
  const run = ++loadGeneration,
    userId = session.user?.id;
  if (!userId) {
    loading.value = false;
    return;
  }
  loading.value = true;
  error.value = "";
  try {
    const list = await api<ListResponse<Order>>("/api/orders");
    if (run !== loadGeneration || session.user?.id !== userId) return;
    orders.value = list.items;
    if (route.query.orderId) {
      const order = await api<Order>("/api/orders/" + route.query.orderId);
      if (run === loadGeneration && session.user?.id === userId) {
        detail.value = order;
        detailOpen.value = true;
      }
    }
  } catch (e) {
    if (run === loadGeneration) error.value = errorMessage(e);
  } finally {
    if (run === loadGeneration) loading.value = false;
  }
}
async function show(o: Order) {
  const userId = session.user?.id;
  detail.value = o;
  detailOpen.value = true;
  try {
    const order = await api<Order>("/api/orders/" + o.id);
    if (
      detail.value?.id === o.id &&
      detailOpen.value &&
      session.user?.id === userId
    )
      detail.value = order;
  } catch (e) {
    ElMessage.error(errorMessage(e));
  }
}
async function action(o: Order, kind: "pay/mock" | "cancel") {
  if (kind === "cancel") {
    try {
      await ElMessageBox.confirm(
        "取消后会释放商品库存，同一活动商品无法再次下单。",
        "确认取消订单",
        {
          confirmButtonText: "确认取消",
          cancelButtonText: "保留订单",
          type: "warning",
        },
      );
    } catch {
      return;
    }
  }
  actionBusy.value = true;
  try {
    const updated = await post<Order>("/api/orders/" + o.id + "/" + kind);
    orders.value = orders.value.map((x) => (x.id === o.id ? updated : x));
    if (detail.value?.id === o.id) detail.value = updated;
    ElMessage.success(kind === "pay/mock" ? "模拟支付成功" : "订单已取消");
  } catch (e) {
    ElMessage.error(errorMessage(e));
    await load();
  } finally {
    actionBusy.value = false;
  }
}
onMounted(() => {
  load();
  timer = window.setInterval(() => (now.value = Date.now()), 1000);
});
onUnmounted(() => window.clearInterval(timer));
watch(
  () => session.user?.id,
  () => {
    orders.value = [];
    detailOpen.value = false;
    load();
  },
);
</script>
<template>
  <div class="content-page orders-page">
    <div class="page-heading">
      <div>
        <p class="eyebrow">每一份期待，都有回响</p>
        <h1>我的订单</h1>
      </div>
      <el-button :icon="Refresh" :loading="loading" @click="load"
        >刷新订单</el-button
      >
    </div>
    <div v-if="!session.user" class="state-panel large">
      <el-icon :size="44"><ShoppingBag /></el-icon>
      <h2>登录后，查看你的好物</h2>
      <p>抢购记录和待付款订单都在这里。</p>
      <el-button type="primary" size="large" @click="requireLogin()"
        >登录 / 注册</el-button
      >
    </div>
    <template v-else
      ><div class="filter-tabs" role="tablist" aria-label="订单状态筛选">
        <button
          v-for="tab in [
            { id: 'ALL', name: '全部订单' },
            { id: 'CREATED', name: '待付款' },
            { id: 'PAID', name: '已支付' },
            { id: 'CANCELLED', name: '已取消' },
            { id: 'CLOSED', name: '已关闭' },
          ]"
          :key="tab.id"
          :class="{ selected: filter === tab.id }"
          role="tab"
          :aria-selected="filter === tab.id"
          @click="filter = tab.id"
        >
          {{ tab.name }}
        </button>
      </div>
      <el-alert
        v-if="error"
        :title="error"
        type="error"
        show-icon
        :closable="false"
        class="form-error"
      /><el-skeleton v-if="loading" :rows="6" animated />
      <div v-else-if="!filtered.length" class="state-panel large">
        <el-icon :size="44"><ShoppingBag /></el-icon>
        <h2>这里还没有订单</h2>
        <p>去发现这一刻值得拥有的好物。</p>
        <el-button type="primary" @click="router.push('/')">去逛逛</el-button>
      </div>
      <article v-for="o in filtered" v-else :key="o.id" class="order-card">
        <div class="order-meta">
          <span
            >{{ dateTime(o.createdAt) }}
            <span class="order-id">订单 {{ o.id }}</span></span
          ><span class="status-pill" :class="o.status.toLowerCase()">{{
            orderLabel[o.status] || o.status
          }}</span>
        </div>
        <div class="order-content">
          <img :src="productImage(o.imageUrl)" :alt="o.productName" />
          <div class="order-product">
            <button class="product-name" @click="show(o)">
              {{ o.productName }}
            </button>
            <p>
              ¥{{ money(o.unitPrice) }} <span>× {{ o.quantity }}</span>
            </p>
            <p v-if="o.status === 'CREATED'" class="deadline">
              付款剩余 {{ remaining(o) }}
            </p>
          </div>
          <div class="order-total">
            <small>合计</small><strong>¥{{ money(o.totalAmount) }}</strong>
          </div>
          <div class="order-actions">
            <el-button
              v-if="o.status === 'CREATED'"
              type="primary"
              :disabled="new Date(o.expireTime).getTime() <= now"
              :loading="actionBusy"
              @click="action(o, 'pay/mock')"
              >模拟支付</el-button
            ><el-button @click="show(o)">订单详情</el-button>
          </div>
        </div>
      </article></template
    >
  </div>
  <el-dialog v-model="detailOpen" title="订单详情" width="600px" align-center
    ><template v-if="detail"
      ><div class="purchase-product">
        <img :src="productImage(detail.imageUrl)" :alt="detail.productName" />
        <div>
          <span class="status-pill" :class="detail.status.toLowerCase()">{{
            orderLabel[detail.status]
          }}</span>
          <h2>{{ detail.productName }}</h2>
          <p>¥{{ money(detail.unitPrice) }} × {{ detail.quantity }}</p>
        </div>
      </div>
      <dl class="detail-list">
        <div>
          <dt>订单编号</dt>
          <dd>{{ detail.id }}</dd>
        </div>
        <div>
          <dt>下单时间</dt>
          <dd>{{ dateTime(detail.createdAt) }}</dd>
        </div>
        <div>
          <dt>订单金额</dt>
          <dd class="accent-price">¥{{ money(detail.totalAmount) }}</dd>
        </div>
        <div v-if="detail.paidAt">
          <dt>支付时间</dt>
          <dd>{{ dateTime(detail.paidAt) }}</dd>
        </div>
        <div v-if="detail.status === 'CREATED'">
          <dt>付款剩余</dt>
          <dd>{{ remaining(detail) }}</dd>
        </div>
      </dl>
      <el-alert
        v-if="detail.status === 'CREATED'"
        title="这是演示订单，模拟支付不会产生真实扣款。"
        type="info"
        :closable="false" /></template
    ><template #footer
      ><div class="dialog-actions">
        <el-button
          v-if="detail?.status === 'CREATED'"
          :loading="actionBusy"
          @click="action(detail, 'cancel')"
          >取消订单</el-button
        ><el-button
          v-if="detail?.status === 'CREATED'"
          type="primary"
          :loading="actionBusy"
          :disabled="new Date(detail.expireTime).getTime() <= now"
          @click="action(detail, 'pay/mock')"
          >模拟支付</el-button
        ><el-button v-else @click="detailOpen = false">关闭</el-button>
      </div></template
    ></el-dialog
  >
</template>
