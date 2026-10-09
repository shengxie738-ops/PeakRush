<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { ArrowRight, Refresh, Clock } from "@element-plus/icons-vue";
import { api, errorMessage } from "../api";
import type { Activity, Item, ListResponse } from "../types";
import { money, timeOnly, productImage } from "../format";
import {
  activityPhase, activityCountdown, sortActivities, chooseActivity,
  catalogRows, catalogCategories, productCategory, productKicker, isCurrentOrFuture,
} from "../storefront";
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
let refreshTimer: number;
let loadGeneration = 0;
let fetching = false;
let manualHistory = false;
const browseAll = ref(true);
const category = ref("全部好物"), refreshError = ref("");
const sortedActivities = computed(() => sortActivities(activities.value, now.value));
const selected = computed(
  () => activities.value.find((a) => a.id === selectedId.value),
);
function phase(a: Activity): string {
  return activityPhase(a, now.value);
}
const rows = computed(() => catalogRows(activities.value, selectedId.value, !route.params.id && browseAll.value, now.value));
const categories = computed(() => catalogCategories(rows.value));
const displayRows = computed(() => rows.value.filter(({ item }) => category.value === "全部好物" || productCategory(item) === category.value));
const remaining = computed(() => selected.value ? activityCountdown(selected.value, now.value) : null);
const noLiveActivities = computed(() => activities.value.length > 0 && !activities.value.some(a => isCurrentOrFuture(a, now.value)));
const sessionMessage = computed(() => {
  if (!selected.value) return loading.value ? "活动正在加载" : "下一场好物正在准备";
  const currentPhase = phase(selected.value);
  if (currentPhase === "已结束") return "本场活动已结束";
  if (currentPhase === "已下线") return "本场活动已下线";
  return "本场已预热，等待启用";
});
const dateLabel = computed(() => {
  return dateFor(selected.value?.startTime || new Date(now.value).toISOString());
});
function dateFor(value: string) {
  const d = new Date(value);
  return (
    String(d.getMonth() + 1).padStart(2, "0") +
    "." +
    String(d.getDate()).padStart(2, "0")
  );
}
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
function syncSelection() {
  if (route.params.id) return;
  const next = chooseActivity(activities.value, selectedId.value, now.value, manualHistory);
  if (selectedId.value !== (next?.id ?? null)) {
    selectedId.value = next?.id ?? null;
    browseAll.value = true;
    manualHistory = false;
  }
}
async function load(quiet = false) {
  if (quiet && fetching) return;
  const run = ++loadGeneration,
    routeId = route.params.id;
  fetching = true;
  if (!quiet) {
    loading.value = true;
    error.value = "";
  }
  refreshError.value = "";
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
      now.value = Date.now();
      syncSelection();
    }
    // A successful quiet refresh also recovers an earlier initial-load failure.
    error.value = "";
  } catch (e) {
    if (run === loadGeneration) {
      if (quiet) refreshError.value = "活动更新未完成：" + errorMessage(e);
      else error.value = errorMessage(e);
    }
  } finally {
    if (run === loadGeneration) {
      loading.value = false;
      fetching = false;
    }
  }
}
function buy(a: Activity, item: Item) {
  purchase.value = { activity: a, item };
  purchaseOpen.value = true;
}
function select(a: Activity) {
  selectedId.value = a.id;
  browseAll.value = false;
  manualHistory = !isCurrentOrFuture(a, now.value);
  category.value = "全部好物";
}
function showAll() {
  if (route.params.id) {
    router.push("/");
    return;
  }
  manualHistory = false;
  browseAll.value = true;
  category.value = "全部好物";
  syncSelection();
}
function refreshVisible() {
  if (document.visibilityState === "visible") {
    now.value = Date.now();
    syncSelection();
    void load(true);
  }
}
onMounted(() => {
  load();
  timer = window.setInterval(() => {
    const previousPhases = activities.value.map(phase).join();
    now.value = Date.now();
    if (previousPhases !== activities.value.map(phase).join()) {
      syncSelection();
      void load(true);
    }
  }, 1000);
  refreshTimer = window.setInterval(refreshVisible, 15000);
  window.addEventListener("focus", refreshVisible);
  document.addEventListener("visibilitychange", refreshVisible);
});
onUnmounted(() => {
  loadGeneration++;
  window.clearInterval(timer);
  window.clearInterval(refreshTimer);
  window.removeEventListener("focus", refreshVisible);
  document.removeEventListener("visibilitychange", refreshVisible);
});
watch(categories, choices => {
  if (!choices.some(choice => choice.name === category.value)) category.value = "全部好物";
});
watch(
  () => route.params.id,
  () => {
    browseAll.value = true;
    manualHistory = false;
    selectedId.value = null;
    category.value = "全部好物";
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
      <div v-if="remaining" class="countdown" aria-label="活动倒计时">
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
      <div v-else class="session-state" role="status">
        <strong>{{ sessionMessage }}</strong>
        <p>{{ noLiveActivities ? "当前没有可参与的场次，敬请期待下一场。" : "查看其他场次，发现下一件心动好物。" }}</p>
        <button class="text-button" @click="load()">刷新活动 <el-icon><Refresh /></el-icon></button>
      </div>
      <div class="session-tabs" aria-label="抢购场次">
        <button
          v-for="a in sortedActivities"
          :key="a.id"
          :aria-pressed="selected?.id === a.id"
          :title="a.name"
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
    <div v-if="!loading && !error" class="catalog-toolbar">
      <div>
        <p class="catalog-eyebrow">{{ route.params.id || !browseAll ? selected?.name : '当前及即将开始的场次' }}</p>
        <h2>{{ category === '全部好物' ? '限时好物' : category }} <small>{{ displayRows.length }} 款</small></h2>
      </div>
      <div class="catalog-actions">
        <button v-if="route.params.id || !browseAll" class="text-button" @click="showAll">全部好物</button>
        <button class="text-button" @click="load()">刷新活动 <el-icon><Refresh /></el-icon></button>
      </div>
      <nav v-if="rows.length" class="category-filters" aria-label="商品分类">
        <button
          v-for="choice in categories"
          :key="choice.name"
          :aria-pressed="category === choice.name"
          :class="{ selected: category === choice.name }"
          @click="category = choice.name"
        >{{ choice.name }} <span>{{ choice.count }}</span></button>
      </nav>
      <p v-if="refreshError" class="catalog-refresh-error" role="status">{{ refreshError }}</p>
    </div>
    <div v-if="error" class="state-panel">
      <h2>好物暂时没有加载出来</h2>
      <p>{{ error }}</p>
      <el-button :icon="Refresh" @click="load()">重新加载</el-button>
    </div>
    <div v-else-if="loading" class="loading-products">
      <el-skeleton :rows="5" animated />
    </div>
    <div v-else-if="!displayRows.length" class="state-panel">
      <h2>{{ noLiveActivities && browseAll ? '本轮活动已结束' : category !== '全部好物' ? '这个类别暂时没有商品' : '下一场好物，正在准备' }}</h2>
      <p>{{ noLiveActivities && browseAll ? '历史场次仍可查看，新的场次准备好后将在这里展示。' : '暂时没有可展示的商品，稍后回来看看。' }}</p>
      <el-button :icon="Refresh" @click="load()">刷新活动</el-button>
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
            {{ productKicker(item) }}
          </p>
          <button class="product-name" @click="buy(activity, item)">
            {{ item.name }}
          </button>
          <p class="product-description">
            {{ item.description || "让心动如期而至，为日常添一份喜欢。" }}
          </p>
          <p v-if="browseAll && !route.params.id" class="product-session">{{ activity.name }} · {{ dateFor(activity.startTime) }} {{ timeOnly(activity.startTime) }} · {{ phase(activity) }}</p>
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
          @click="showAll"
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
    @changed="load()"
  />
</template>
