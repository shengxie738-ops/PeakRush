<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { ArrowRight, Refresh, Clock } from "@element-plus/icons-vue";
import { api, errorMessage } from "../api";
import type { Activity, Item, ListResponse } from "../types";
import { money, timeOnly, productImage } from "../format";
import PurchaseDialog from "../components/PurchaseDialog.vue";
const route = useRoute(),
  router = useRouter();
const activities = ref<Activity[]>([]),
  selectedId = ref<number | null>(null),
  loading = ref(true),
  error = ref(""),
  now = ref(Date.now());
const purchase = ref<{ activity: Activity; item: Item } | null>(null),
  purchaseOpen = ref(false);
let timer: number;
let loadGeneration = 0;
const browseAll = ref(true);
const selected = computed(
  () =>
    activities.value.find((a) => a.id === selectedId.value) ||
    activities.value[0],
);
function phase(a: Activity): string {
  if (a.status === "OFFLINE" || a.status === "DRAFT") return "已下线";
  if (now.value > new Date(a.endTime).getTime() || a.status === "ENDED")
    return "已结束";
  if (now.value < new Date(a.startTime).getTime()) return "即将开始";
  if (a.status === "PREHEATED") return "即将开始";
  if (a.status === "SOLD_OUT") return "暂时售罄";
  return "正在进行";
}
const displayRows = computed(() => {
  const current = selected.value;
  if (!current) return [];
  const show = [current];
  if (!route.params.id && browseAll.value) {
    const upcoming = activities.value
      .filter((a) => a.id !== current.id && phase(a) === "即将开始")
      .sort(
        (a, b) =>
          new Date(a.startTime).getTime() - new Date(b.startTime).getTime(),
      );
    show.push(...upcoming);
  }
  const rows = show.flatMap((activity) =>
    (activity.items || []).map((item) => ({ activity, item })),
  );
  if (route.params.id || !browseAll.value) return rows;
  const seen = new Set<number>();
  return rows
    .filter(({ item }) => {
      if (seen.has(item.productId)) return false;
      seen.add(item.productId);
      return true;
    })
    .slice(0, 6);
});
const remaining = computed(() => {
  const a = selected.value;
  if (!a) return ["00", "00", "00"];
  const target = phase(a) === "即将开始" ? a.startTime : a.endTime;
  const seconds = Math.max(
    0,
    Math.floor((new Date(target).getTime() - now.value) / 1000),
  );
  return [
    Math.floor(seconds / 3600),
    Math.floor(seconds / 60) % 60,
    seconds % 60,
  ].map((n) => String(n).padStart(2, "0"));
});
const dateLabel = computed(() => {
  const d = selected.value ? new Date(selected.value.startTime) : new Date();
  return (
    String(d.getMonth() + 1).padStart(2, "0") +
    "." +
    String(d.getDate()).padStart(2, "0")
  );
});
function label(a: Activity, item: Item) {
  const p = phase(a);
  if (p === "即将开始") return timeOnly(a.startTime) + " 开抢";
  if (p === "已结束" || p === "已下线") return p;
  if (item.availableStock === 0 || p === "暂时售罄") return "本场已抢光";
  return "立即抢购";
}
function canBuy(a: Activity, item: Item) {
  return phase(a) === "正在进行" && item.availableStock !== 0;
}
async function load() {
  const run = ++loadGeneration,
    routeId = route.params.id;
  loading.value = true;
  error.value = "";
  try {
    if (routeId) {
      const a = await api<Activity>("/api/seckill/activities/" + routeId);
      if (run !== loadGeneration) return;
      activities.value = [a];
      selectedId.value = a.id;
    } else {
      const data = await api<ListResponse<Activity>>("/api/seckill/activities");
      if (run !== loadGeneration) return;
      activities.value = data.items;
      const current = data.items.find((a) => phase(a) === "正在进行");
      const upcoming = data.items
        .filter((a) => phase(a) === "即将开始")
        .sort(
          (a, b) =>
            new Date(a.startTime).getTime() - new Date(b.startTime).getTime(),
        )[0];
      if (!data.items.some((a) => a.id === selectedId.value))
        selectedId.value =
          current?.id || upcoming?.id || data.items[0]?.id || null;
    }
  } catch (e) {
    if (run === loadGeneration) error.value = errorMessage(e);
  } finally {
    if (run === loadGeneration) loading.value = false;
  }
}
function buy(a: Activity, item: Item) {
  purchase.value = { activity: a, item };
  purchaseOpen.value = true;
}
function select(a: Activity) {
  selectedId.value = a.id;
  browseAll.value = false;
}
onMounted(() => {
  load();
  timer = window.setInterval(() => (now.value = Date.now()), 1000);
});
onUnmounted(() => window.clearInterval(timer));
watch(
  () => route.params.id,
  () => {
    browseAll.value = true;
    load();
  },
);
</script>
<template>
  <section class="store-hero" aria-labelledby="hero-title">
    <div class="hero-copy">
      <p class="eyebrow">
        {{ selected?.name || "限时好物专场" }} <span>·</span> {{ dateLabel }}
      </p>
      <h1 id="hero-title">这一刻，<br />好物开抢。</h1>
      <p class="hero-description">
        优质好物，限时限量。用更好的产品，点亮每一个日常。
      </p>
      <div class="countdown" aria-label="活动倒计时">
        <span class="countdown-intro">{{
          selected && phase(selected) === "即将开始"
            ? "距离本场开始"
            : "距离本场结束"
        }}</span>
        <div v-for="(part, index) in remaining" :key="index" class="time-part">
          <span>{{ part }}</span
          ><small>{{ ["小时", "分钟", "秒"][index] }}</small>
        </div>
      </div>
      <div class="session-tabs" aria-label="抢购场次" role="tablist">
        <button
          v-for="a in activities.slice(0, 4)"
          :key="a.id"
          role="tab"
          :aria-selected="selected?.id === a.id"
          :class="{ selected: selected?.id === a.id }"
          @click="select(a)"
        >
          <strong>{{ timeOnly(a.startTime) }}</strong
          ><span>{{ phase(a) }}</span>
        </button>
        <div v-if="!activities.length" class="session-placeholder">
          <el-icon><Clock /></el-icon
          ><span>{{ loading ? "好物正在赶来" : "期待下一次准点相遇" }}</span>
        </div>
      </div>
    </div>
    <div class="hero-visual">
      <img
        src="/assets/hero-earbuds.png"
        alt="暖橙色日光下的黑色无线耳机和充电盒"
        fetchpriority="high"
      />
    </div>
  </section>
  <section
    class="product-section"
    aria-label="本场限量好物"
    :aria-busy="loading"
  >
    <div v-if="error" class="state-panel">
      <h2>好物暂时没有加载出来</h2>
      <p>{{ error }}</p>
      <el-button :icon="Refresh" @click="load">重新加载</el-button>
    </div>
    <div v-else-if="loading" class="loading-products">
      <el-skeleton :rows="5" animated />
    </div>
    <div v-else-if="!displayRows.length" class="state-panel">
      <h2>下一场好物，正在准备</h2>
      <p>暂时没有可展示的商品，稍后回来看看。</p>
      <el-button :icon="Refresh" @click="load">刷新活动</el-button>
    </div>
    <template v-else
      ><article
        v-for="({ activity, item }, index) in displayRows"
        :key="activity.id + '-' + item.id"
        class="product-row"
      >
        <button
          class="product-picture"
          @click="buy(activity, item)"
          :aria-label="'查看' + item.name"
        >
          <img
            :src="productImage(item.imageUrl)"
            :alt="item.name"
            :loading="index ? 'lazy' : 'eager'"
          />
        </button>
        <div class="product-copy">
          <p class="product-kicker">
            {{
              index === 0
                ? "好音质 · 轻量化 · 长续航"
                : index === 1
                  ? "记录热爱 · 留住每一个瞬间"
                  : "自在生活 · 每一天都有新发现"
            }}
          </p>
          <button class="product-name" @click="buy(activity, item)">
            {{ item.name }}
          </button>
          <p class="product-description">
            {{ item.description || "让心动如期而至，为日常添一份喜欢。" }}
          </p>
        </div>
        <div class="product-offer">
          <div class="price-line" :class="{ featured: index === 0 }">
            <span class="currency">¥</span
            ><strong>{{ money(item.seckillPrice) }}</strong
            ><del>¥{{ money(item.originalPrice) }}</del>
          </div>
          <p class="stock-line">
            <template v-if="phase(activity) === '正在进行'"
              >剩余 <b>{{ item.availableStock ?? "—" }}</b> 件</template
            ><template v-else>限量 {{ item.totalStock }} 件</template
            ><span>·</span>每人限购 {{ item.limitPerUser }} 件
          </p>
        </div>
        <button
          class="buy-button"
          :class="{ muted: !canBuy(activity, item) }"
          :disabled="!canBuy(activity, item)"
          @click="buy(activity, item)"
        >
          {{ label(activity, item)
          }}<el-icon v-if="canBuy(activity, item)"><ArrowRight /></el-icon>
        </button>
      </article>
      <div class="store-info">
        <p>限量好物，每人每场每件商品限下一单。数量和状态以提交结果为准。</p>
        <button
          v-if="route.params.id"
          class="text-button"
          @click="router.push('/')"
        >
          查看所有场次</button
        ><button
          v-else-if="!browseAll"
          class="text-button"
          @click="browseAll = true"
        >
          全部好物</button
        ><button
          v-else-if="selected"
          class="text-button"
          @click="router.push('/activities/' + selected.id)"
        >
          活动详情 <el-icon><ArrowRight /></el-icon>
        </button></div
    ></template>
  </section>
  <PurchaseDialog
    v-if="purchase"
    v-model="purchaseOpen"
    :activity="purchase.activity"
    :item="purchase.item"
    @changed="load"
  />
</template>
