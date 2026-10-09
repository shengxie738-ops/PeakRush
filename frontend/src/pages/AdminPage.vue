<script setup lang="ts">
import { computed, onMounted, onUnmounted, reactive, ref, watch } from "vue";
import {
  Plus,
  Refresh,
  Edit,
  Delete,
  DataAnalysis,
  Goods,
  Calendar,
  Operation,
  Warning,
} from "@element-plus/icons-vue";
import { ElMessage, ElMessageBox } from "element-plus";
import { api, post, errorMessage, ApiError } from "../api";
import { session, requireLogin } from "../session";
import { money, dateTime, activityLabel, productImage } from "../format";
import { PRODUCT_CATEGORIES, productCategory } from "../storefront";
import type {
  Product,
  Activity,
  ListResponse,
  Metrics,
  Experiment,
  DeadLetter,
} from "../types";
type Tab = "products" | "activities" | "metrics" | "experiments" | "recovery";
interface ActivityInput {
  name: string;
  description: string;
  startTime: string;
  endTime: string;
  architectureVersion: string;
  items: {
    productId: number;
    seckillPrice: number;
    totalStock: number;
    limitPerUser: number;
  }[];
}
interface Faults {
  consumerPaused: boolean;
  consumerDelayMs: number;
  failConsumer: boolean;
  pauseBridge: boolean;
  pauseOutbox: boolean;
  afterDbCommitPauseMs: number;
  afterRedisApplyPauseMs: number;
}
const tab = ref<Tab>("activities"),
  loading = ref(false),
  busy = ref(false),
  error = ref(""),
  products = ref<Product[]>([]),
  activities = ref<Activity[]>([]),
  metrics = ref<Metrics | null>(null),
  experiments = ref<Experiment[]>([]),
  letters = ref<DeadLetter[]>([]),
  updatedAt = ref("");
const tabs = [
  { id: "activities" as Tab, label: "活动管理", icon: Calendar },
  { id: "products" as Tab, label: "商品管理", icon: Goods },
  { id: "metrics" as Tab, label: "实时指标", icon: DataAnalysis },
  { id: "experiments" as Tab, label: "压测实验", icon: Operation },
  { id: "recovery" as Tab, label: "故障与恢复", icon: Warning },
];
const productDialog = ref(false),
  productId = ref<number | null>(null),
  productForm = reactive({
    name: "",
    category: "其他好物",
    description: "",
    imageUrl: "/assets/product-earbuds.png",
    originalPrice: 399,
  });
const activityDialog = ref(false),
  activityId = ref<number | null>(null),
  activityForm = reactive<ActivityInput>({
    name: "",
    description: "",
    startTime: "",
    endTime: "",
    architectureVersion: "V3",
    items: [],
  });
const experimentDialog = ref(false),
  experimentForm = reactive({
    name: "",
    architectureVersion: "V3",
    concurrency: 200,
    durationSeconds: 60,
    stock: 100,
    notes: "",
  });
const resultsDialog = ref(false),
  resultsId = ref<number | null>(null),
  resultsJson = ref(""),
  formError = ref("");
const faults = reactive<Faults>({
    consumerPaused: false,
    consumerDelayMs: 0,
    failConsumer: false,
    pauseBridge: false,
    pauseOutbox: false,
    afterDbCommitPauseMs: 0,
    afterRedisApplyPauseMs: 0,
  }),
  faultsAvailable = ref(false);
let timer: number;
const admin = computed(() => session.user?.role === "ADMIN");
const metricCards = computed(() =>
  metrics.value
    ? [
        { label: "请求总数", value: metrics.value.requests },
        { label: "成功受理", value: metrics.value.successes },
        { label: "处理中", value: metrics.value.pending },
        { label: "失败 / 拒绝", value: metrics.value.failures },
        { label: "订单总数", value: metrics.value.orders },
        { label: "已支付订单", value: metrics.value.paidOrders },
        { label: "P95 延迟 (ms)", value: metrics.value.latencyP95Ms },
        { label: "Kafka 消费积压", value: metrics.value.kafkaLag },
      ]
    : [],
);
function val(v: number | null | undefined) {
  return v === null || v === undefined ? "未采集" : v.toLocaleString("zh-CN");
}
async function fetchProducts() {
  products.value = (
    await api<ListResponse<Product>>("/api/admin/products")
  ).items;
}
async function load(quiet = false) {
  if (!admin.value) return;
  if (!quiet) {
    loading.value = true;
    error.value = "";
  }
  try {
    if (tab.value === "products") await fetchProducts();
    if (tab.value === "activities") {
      const [a, p] = await Promise.all([
        api<ListResponse<Activity>>("/api/admin/activities"),
        api<ListResponse<Product>>("/api/admin/products"),
      ]);
      activities.value = a.items;
      products.value = p.items;
    }
    if (tab.value === "metrics") {
      metrics.value = await api<Metrics>("/api/admin/metrics/summary");
      updatedAt.value = new Date().toLocaleTimeString("zh-CN");
    }
    if (tab.value === "experiments") {
      const list = (
        await api<ListResponse<Experiment>>("/api/admin/experiments")
      ).items;
      experiments.value = await Promise.all(
        list.map(async (e) => {
          try {
            return await api<Experiment>(
              "/api/admin/experiments/" + e.id + "/export",
            );
          } catch {
            return e;
          }
        }),
      );
    }
    if (tab.value === "recovery") {
      letters.value = (
        await api<ListResponse<DeadLetter>>("/api/admin/dead-letters")
      ).items;
      try {
        Object.assign(faults, await api<Faults>("/api/admin/faults"));
        faultsAvailable.value = true;
      } catch (e) {
        if (e instanceof ApiError && (e.status === 404 || e.status === 403)) {
          faultsAvailable.value = false;
        } else throw e;
      }
    }
  } catch (e) {
    error.value = errorMessage(e);
  } finally {
    if (!quiet) loading.value = false;
  }
}
function localInput(iso: string) {
  const d = new Date(iso);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);
}
function openProduct(p?: Product) {
  formError.value = "";
  productId.value = p?.id ?? null;
  Object.assign(
    productForm,
    p
      ? {
          name: p.name,
          category: productCategory(p),
          description: p.description,
          imageUrl: p.imageUrl,
          originalPrice: p.originalPrice,
        }
      : {
          name: "",
          category: "其他好物",
          description: "",
          imageUrl: "/assets/product-earbuds.png",
          originalPrice: 399,
        },
  );
  productDialog.value = true;
}
async function saveProduct() {
  formError.value = "";
  if (!productForm.name.trim() || Number(productForm.originalPrice) <= 0) {
    formError.value = "请填写商品名称及有效原价。";
    return;
  }
  busy.value = true;
  try {
    await api(
      "/api/admin/products" + (productId.value ? "/" + productId.value : ""),
      {
        method: productId.value ? "PUT" : "POST",
        body: JSON.stringify(productForm),
      },
    );
    productDialog.value = false;
    ElMessage.success("商品已保存");
    await load();
  } catch (e) {
    formError.value = errorMessage(e);
  } finally {
    busy.value = false;
  }
}
async function deleteProduct(p: Product) {
  try {
    await ElMessageBox.confirm(
      "确认删除“" + p.name + "”？已关联活动的商品可能无法删除。",
      "删除商品",
      { type: "warning", confirmButtonText: "删除", cancelButtonText: "取消" },
    );
    await api("/api/admin/products/" + p.id, { method: "DELETE" });
    ElMessage.success("商品已删除");
    await load();
  } catch (e) {
    if (e !== "cancel" && e !== "close") ElMessage.error(errorMessage(e));
  }
}
function addItem() {
  const p = products.value[0];
  activityForm.items.push({
    productId: p?.id || 0,
    seckillPrice: p?.originalPrice || 1,
    totalStock: 100,
    limitPerUser: 1,
  });
}
function openActivity(a?: Activity) {
  formError.value = "";
  activityId.value = a?.id ?? null;
  Object.assign(
    activityForm,
    a
      ? {
          name: a.name,
          description: a.description,
          startTime: localInput(a.startTime),
          endTime: localInput(a.endTime),
          architectureVersion: a.architectureVersion,
          items: a.items.map((i) => ({
            productId: i.productId,
            seckillPrice: Number(i.seckillPrice),
            totalStock: i.totalStock,
            limitPerUser: i.limitPerUser,
          })),
        }
      : {
          name: "",
          description: "",
          startTime: localInput(new Date(Date.now() + 600000).toISOString()),
          endTime: localInput(new Date(Date.now() + 7200000).toISOString()),
          architectureVersion: "V3",
          items: [],
        },
  );
  if (!a) addItem();
  activityDialog.value = true;
}
async function saveActivity() {
  formError.value = "";
  if (
    !activityForm.name.trim() ||
    !activityForm.startTime ||
    !activityForm.endTime ||
    new Date(activityForm.startTime) >= new Date(activityForm.endTime)
  ) {
    formError.value = "请填写活动名称，并确保结束时间晚于开始时间。";
    return;
  }
  if (
    !activityForm.items.length ||
    activityForm.items.some(
      (i) =>
        !i.productId ||
        i.totalStock < 1 ||
        i.limitPerUser < 1 ||
        i.seckillPrice <= 0,
    ) ||
    new Set(activityForm.items.map((i) => i.productId)).size !==
      activityForm.items.length
  ) {
    formError.value = "请添加不重复的商品，并填写有效的价格、库存和限购数量。";
    return;
  }
  busy.value = true;
  try {
    await api(
      "/api/admin/activities" +
        (activityId.value ? "/" + activityId.value : ""),
      {
        method: activityId.value ? "PUT" : "POST",
        body: JSON.stringify({
          ...activityForm,
          startTime: new Date(activityForm.startTime).toISOString(),
          endTime: new Date(activityForm.endTime).toISOString(),
        }),
      },
    );
    activityDialog.value = false;
    ElMessage.success("活动已保存");
    await load();
  } catch (e) {
    formError.value = errorMessage(e);
  } finally {
    busy.value = false;
  }
}
async function activityAction(
  a: Activity,
  action: "warmup" | "activate" | "offline",
) {
  if (action === "offline") {
    try {
      await ElMessageBox.confirm(
        "下线将停止接受新的抢购请求，已受理的订单仍会继续处理。",
        "下线活动",
        {
          confirmButtonText: "确认下线",
          cancelButtonText: "取消",
          type: "warning",
        },
      );
    } catch {
      return;
    }
  }
  busy.value = true;
  try {
    await post("/api/admin/activities/" + a.id + "/" + action);
    ElMessage.success(
      { warmup: "活动已预热", activate: "活动已启用", offline: "活动已下线" }[
        action
      ],
    );
    await load();
  } catch (e) {
    ElMessage.error(errorMessage(e));
  } finally {
    busy.value = false;
  }
}
async function saveExperiment() {
  formError.value = "";
  if (!experimentForm.name.trim()) {
    formError.value = "请输入实验名称。";
    return;
  }
  busy.value = true;
  try {
    await post("/api/admin/experiments", experimentForm);
    experimentDialog.value = false;
    ElMessage.success("实验配置已记录");
    await load();
  } catch (e) {
    formError.value = errorMessage(e);
  } finally {
    busy.value = false;
  }
}
async function exportExperiment(e: Experiment) {
  try {
    const data = await api<unknown>(
      "/api/admin/experiments/" + e.id + "/export",
    );
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = "peakrush-experiment-" + e.id + ".json";
    link.click();
    URL.revokeObjectURL(url);
  } catch (e) {
    ElMessage.error(errorMessage(e));
  }
}
async function openResults(e: Experiment) {
  resultsId.value = e.id;
  resultsJson.value = e.results ? JSON.stringify(e.results, null, 2) : "";
  formError.value = "";
  resultsDialog.value = true;
  try {
    const latest = await api<Experiment>(
      "/api/admin/experiments/" + e.id + "/export",
    );
    if (resultsId.value === e.id)
      resultsJson.value = latest.results
        ? JSON.stringify(latest.results, null, 2)
        : "";
  } catch (err) {
    formError.value = errorMessage(err);
  }
}
function workloadDuration(e: Experiment) {
  const model = (e.results as { workload?: { model?: unknown } } | undefined)
    ?.workload?.model;
  return typeof model === "string" && model.toLowerCase().includes("burst")
    ? "瞬时突发"
    : e.durationSeconds + " 秒";
}
function measured(
  e: Experiment,
  section: string,
  field: string,
  percent = false,
) {
  const data = e.results as Record<string, Record<string, unknown>> | undefined;
  const value = data?.[section]?.[field];
  if (typeof value !== "number" || !Number.isFinite(value)) return "—";
  return (
    (percent ? value * 100 : value).toLocaleString("zh-CN", {
      maximumFractionDigits: 2,
    }) + (percent ? "%" : "")
  );
}
async function importFile(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0];
  if (file) {
    if (file.size > 5000000) {
      formError.value = "结果文件不能超过 5 MB。";
      return;
    }
    resultsJson.value = await file.text();
    formError.value = "";
  }
}
async function saveResults() {
  formError.value = "";
  let data: unknown;
  try {
    data = JSON.parse(resultsJson.value);
    if (!data || typeof data !== "object" || Array.isArray(data))
      throw new Error();
  } catch {
    formError.value = "请输入有效的 JSON 对象，或选择真实压测结果文件。";
    return;
  }
  busy.value = true;
  try {
    await post("/api/admin/experiments/" + resultsId.value + "/results", data);
    resultsDialog.value = false;
    ElMessage.success("真实实验结果已保存");
    await load();
  } catch (e) {
    formError.value = errorMessage(e);
  } finally {
    busy.value = false;
  }
}
async function letterAction(d: DeadLetter, action: "retry" | "abort") {
  if (action === "abort") {
    try {
      await ElMessageBox.confirm(
        "终止这条失败请求并触发库存恢复。此操作不会创建订单。",
        "终止并补偿",
        {
          confirmButtonText: "确认终止",
          cancelButtonText: "取消",
          type: "warning",
        },
      );
    } catch {
      return;
    }
  }
  busy.value = true;
  try {
    await post("/api/admin/dead-letters/" + d.id + "/" + action);
    ElMessage.success(action === "retry" ? "已安排重试" : "已安排终止及补偿");
    await load();
  } catch (e) {
    ElMessage.error(errorMessage(e));
  } finally {
    busy.value = false;
  }
}
async function saveFaults(reset = false) {
  busy.value = true;
  try {
    const value = reset
      ? {
          consumerPaused: false,
          consumerDelayMs: 0,
          failConsumer: false,
          pauseBridge: false,
          pauseOutbox: false,
          afterDbCommitPauseMs: 0,
          afterRedisApplyPauseMs: 0,
        }
      : { ...faults };
    Object.assign(faults, await post<Faults>("/api/admin/faults", value));
    ElMessage.success(reset ? "已恢复正常处理" : "实验故障配置已应用");
  } catch (e) {
    ElMessage.error(errorMessage(e));
  } finally {
    busy.value = false;
  }
}
watch(tab, () => load());
watch(
  () => session.user?.id,
  () => load(),
);
onMounted(() => {
  load();
  timer = window.setInterval(() => {
    if (tab.value === "metrics" && admin.value) load(true);
  }, 5000);
});
onUnmounted(() => window.clearInterval(timer));
</script>
<template>
  <div class="content-page admin-page">
    <div class="page-heading">
      <div>
        <p class="eyebrow">PeakRush 管理中心</p>
        <h1>让每一场，准备就绪。</h1>
      </div>
      <el-button :icon="Refresh" :loading="loading" @click="load()"
        >刷新</el-button
      >
    </div>
    <div v-if="!admin" class="state-panel large">
      <h2>
        {{ session.user ? "此页面仅对管理员开放" : "登录管理员账号以继续" }}
      </h2>
      <p>商品、活动与运行状态都在这里管理。</p>
      <el-button v-if="!session.user" type="primary" @click="requireLogin()"
        >登录</el-button
      ><RouterLink v-else to="/" class="text-button">返回限时抢购</RouterLink>
    </div>
    <template v-else
      ><div class="admin-tabs" role="tablist" aria-label="管理模块">
        <button
          v-for="t in tabs"
          :key="t.id"
          role="tab"
          :aria-selected="tab === t.id"
          :class="{ selected: tab === t.id }"
          @click="tab = t.id"
        >
          <el-icon><component :is="t.icon" /></el-icon>{{ t.label }}
        </button>
      </div>
      <el-alert
        v-if="error"
        :title="error"
        type="error"
        show-icon
        :closable="false"
        class="form-error"
      />
      <section v-loading="loading" class="admin-surface">
        <template v-if="tab === 'products'"
          ><div class="section-heading">
            <div>
              <h2>商品库</h2>
              <p>维护商品信息，随时准备下一场好物。</p>
            </div>
            <el-button type="primary" :icon="Plus" @click="openProduct()"
              >新增商品</el-button
            >
          </div>
          <el-table
            :data="products"
            empty-text="还没有商品，点击“新增商品”开始。"
            style="width: 100%"
            ><el-table-column label="商品" min-width="290"
              ><template #default="{ row }"
                ><div class="table-product">
                  <img :src="productImage(row.imageUrl)" :alt="row.name" />
                  <div>
                    <strong>{{ row.name }}</strong>
                    <p>{{ row.description }}</p>
                  </div>
                </div></template
              ></el-table-column
            ><el-table-column label="分类" width="120"
              ><template #default="{ row }">{{ productCategory(row) }}</template
              ></el-table-column
            ><el-table-column label="原价" width="140"
              ><template #default="{ row }"
                >¥{{ money(row.originalPrice) }}</template
              ></el-table-column
            ><el-table-column label="操作" width="190"
              ><template #default="{ row }"
                ><el-button :icon="Edit" text @click="openProduct(row)"
                  >编辑</el-button
                ><el-button
                  :icon="Delete"
                  type="danger"
                  text
                  @click="deleteProduct(row)"
                  >删除</el-button
                ></template
              ></el-table-column
            ></el-table
          ></template
        >
        <template v-if="tab === 'activities'"
          ><div class="section-heading">
            <div>
              <h2>活动安排</h2>
              <p>创建活动，预热库存，再开启你的下一场抢购。</p>
            </div>
            <el-button
              type="primary"
              :icon="Plus"
              :disabled="!products.length"
              @click="openActivity()"
              >创建活动</el-button
            >
          </div>
          <el-alert
            v-if="!products.length && !loading"
            title="请先在商品管理中添加商品，再创建活动。"
            type="info"
            :closable="false"
          /><el-table
            :data="activities"
            empty-text="还没有活动。"
            style="width: 100%"
            ><el-table-column label="活动名称" min-width="190"
              ><template #default="{ row }"
                ><strong>{{ row.name }}</strong>
                <p class="table-description">{{ row.description }}</p></template
              ></el-table-column
            ><el-table-column label="时间" min-width="195"
              ><template #default="{ row }"
                >{{ dateTime(row.startTime) }}<br />{{
                  dateTime(row.endTime)
                }}</template
              ></el-table-column
            ><el-table-column
              label="版本"
              width="80"
              prop="architectureVersion"
            /><el-table-column label="状态" width="105"
              ><template #default="{ row }"
                ><el-tag
                  :type="
                    row.status === 'RUNNING'
                      ? 'success'
                      : row.status === 'OFFLINE'
                        ? 'info'
                        : 'warning'
                  "
                  effect="light"
                  >{{ activityLabel[row.status] || row.status }}</el-tag
                ></template
              ></el-table-column
            ><el-table-column label="商品 / 库存" min-width="160"
              ><template #default="{ row }"
                ><div
                  v-for="item in row.items"
                  :key="item.id"
                  class="table-item"
                >
                  {{ item.name
                  }}<small
                    >{{ item.availableStock ?? "—" }} /
                    {{ item.totalStock }} 件</small
                  >
                </div></template
              ></el-table-column
            ><el-table-column label="操作" min-width="250"
              ><template #default="{ row }"
                ><div class="table-actions">
                  <el-button
                    v-if="row.status === 'DRAFT'"
                    size="small"
                    @click="openActivity(row)"
                    >编辑</el-button
                  ><el-button
                    v-if="['DRAFT', 'PREHEATED'].includes(row.status)"
                    size="small"
                    :loading="busy"
                    @click="activityAction(row, 'warmup')"
                    >预热</el-button
                  ><el-button
                    v-if="['PREHEATED'].includes(row.status)"
                    size="small"
                    type="primary"
                    :loading="busy"
                    @click="activityAction(row, 'activate')"
                    >启用</el-button
                  ><el-button
                    v-if="!['OFFLINE', 'ENDED', 'DRAFT'].includes(row.status)"
                    size="small"
                    type="danger"
                    plain
                    :loading="busy"
                    @click="activityAction(row, 'offline')"
                    >下线</el-button
                  ><RouterLink :to="'/activities/' + row.id" class="table-link"
                    >查看</RouterLink
                  >
                </div></template
              ></el-table-column
            ></el-table
          ></template
        >
        <template v-if="tab === 'metrics'"
          ><div class="section-heading">
            <div>
              <h2>运行概览</h2>
              <p>
                真实服务指标，每 5 秒刷新。{{
                  updatedAt ? "最近更新 " + updatedAt : ""
                }}
              </p>
            </div>
            <span class="quiet-badge">实时采集</span>
          </div>
          <div v-if="metrics" class="metric-grid">
            <article
              v-for="m in metricCards"
              :key="m.label"
              class="metric-card"
            >
              <p>{{ m.label }}</p>
              <strong>{{ val(m.value) }}</strong>
            </article>
          </div>
          <div v-if="metrics" class="inventory-panels">
            <article>
              <h3>库存与持久化</h3>
              <dl class="detail-list">
                <div>
                  <dt>MySQL 可用库存</dt>
                  <dd>{{ val(metrics.dbAvailableStock) }}</dd>
                </div>
                <div>
                  <dt>Redis 可用库存</dt>
                  <dd>{{ val(metrics.redisAvailableStock) }}</dd>
                </div>
                <div>
                  <dt>待发送 / 待补偿任务</dt>
                  <dd>{{ val(metrics.outboxPending) }}</dd>
                </div>
                <div>
                  <dt>死信数量</dt>
                  <dd>{{ val(metrics.deadLetters) }}</dd>
                </div>
              </dl>
            </article>
            <article>
              <h3>读懂这些数字</h3>
              <p>
                受理请求、成功订单和已支付订单分别统计。Redis
                预占与数据库落单之间存在处理中状态，运行期间两侧库存可能暂时不同。
              </p>
              <p>
                “未采集”表示服务尚未提供该指标，不代表数值为零。吞吐和延迟比较需要使用同一环境与同一压测场景。
              </p>
            </article>
          </div>
          <div v-if="metrics?.versions?.length" class="version-summary">
            <h3>各版本活动配置</h3>
            <el-table :data="metrics.versions"
              ><el-table-column
                prop="version"
                label="架构版本" /><el-table-column
                prop="activities"
                label="活动数量"
            /></el-table>
          </div>
          <el-empty
            v-if="!metrics && !loading"
            description="暂无指标，服务就绪后刷新查看。"
        /></template>
        <template v-if="tab === 'experiments'"
          ><div class="section-heading">
            <div>
              <h2>架构对比实验</h2>
              <p>记录配置，导入真实测试数据，比较 V0 — V3。</p>
            </div>
            <el-button
              type="primary"
              :icon="Plus"
              @click="
                experimentDialog = true;
                formError = '';
              "
              >记录实验</el-button
            >
          </div>
          <el-alert
            title="这里记录实验，不会自动发起压测。指标来自 verification_load.py 的真实结果；配置用户为实验参数，峰值在途为实测值。QPS 包括业务拒绝，订单 TPS 单独统计。“—”表示尚无测量数据。"
            type="info"
            :closable="false"
            class="section-alert"
          /><el-table :data="experiments" empty-text="尚未记录实验。"
            ><el-table-column
              label="实验名称"
              prop="name"
              min-width="170"
            /><el-table-column
              label="版本"
              prop="architectureVersion"
              width="90"
            /><el-table-column
              label="配置用户"
              prop="concurrency"
              width="110"
            /><el-table-column label="持续 / 库存" min-width="135"
              ><template #default="{ row }"
                >{{ workloadDuration(row) }} / {{ row.stock }} 件</template
              ></el-table-column
            ><el-table-column label="峰值在途" min-width="110"
              ><template #default="{ row }">{{
                measured(row, "workload", "peakObservedInflight")
              }}</template></el-table-column
            ><el-table-column label="实测 QPS" min-width="110"
              ><template #default="{ row }">{{
                measured(row, "http", "qps")
              }}</template></el-table-column
            ><el-table-column label="P95 (ms)" min-width="110"
              ><template #default="{ row }">{{
                measured(row, "http", "p95Ms")
              }}</template></el-table-column
            ><el-table-column label="订单 TPS" min-width="110"
              ><template #default="{ row }">{{
                measured(row, "orders", "orderTps")
              }}</template></el-table-column
            ><el-table-column label="服务 / 网络错误率" min-width="150"
              ><template #default="{ row }">{{
                measured(row, "http", "serverOrNetworkErrorRatio", true)
              }}</template></el-table-column
            ><el-table-column
              label="备注"
              prop="notes"
              min-width="160"
            /><el-table-column label="操作" min-width="210"
              ><template #default="{ row }"
                ><el-button text type="primary" @click="openResults(row)"
                  >导入 / 查看结果</el-button
                ><el-button text @click="exportExperiment(row)"
                  >导出 JSON</el-button
                ></template
              ></el-table-column
            ></el-table
          ></template
        >
        <template v-if="tab === 'recovery'"
          ><div class="section-heading">
            <div>
              <h2>失败请求与恢复</h2>
              <p>检查死信原因，重试请求或终止并恢复库存。</p>
            </div>
            <span class="quiet-badge">管理员专用</span>
          </div>
          <el-table :data="letters" empty-text="暂无待处理死信。"
            ><el-table-column
              label="请求编号"
              prop="requestId"
              min-width="240"
              show-overflow-tooltip
            /><el-table-column
              label="失败原因"
              prop="reason"
              min-width="230"
              show-overflow-tooltip
            /><el-table-column
              label="次数"
              prop="attempts"
              width="70"
            /><el-table-column
              label="状态"
              prop="status"
              width="120"
            /><el-table-column label="时间" min-width="140"
              ><template #default="{ row }">{{
                dateTime(row.createdAt)
              }}</template></el-table-column
            ><el-table-column label="操作" min-width="180"
              ><template #default="{ row }"
                ><el-button
                  text
                  type="primary"
                  :loading="busy"
                  :disabled="['ABORTED', 'RESOLVED'].includes(row.status)"
                  @click="letterAction(row, 'retry')"
                  >重试</el-button
                ><el-button
                  text
                  type="danger"
                  :loading="busy"
                  :disabled="['ABORTED', 'RESOLVED'].includes(row.status)"
                  @click="letterAction(row, 'abort')"
                  >终止并补偿</el-button
                ></template
              ></el-table-column
            ></el-table
          >
          <div v-if="faultsAvailable" class="fault-panel">
            <div class="section-heading">
              <div>
                <h3>实验故障注入</h3>
                <p>仅在 lab 环境开放。完成验证后，请恢复正常处理。</p>
              </div>
              <el-tag type="warning">LAB</el-tag>
            </div>
            <div class="fault-grid">
              <label
                ><span>暂停订单消费者</span
                ><el-switch
                  v-model="faults.consumerPaused"
                  aria-label="暂停订单消费者" /></label
              ><label
                ><span>强制消费失败</span
                ><el-switch
                  v-model="faults.failConsumer"
                  aria-label="强制消费失败" /></label
              ><label
                ><span>暂停事件中继</span
                ><el-switch
                  v-model="faults.pauseBridge"
                  aria-label="暂停事件中继" /></label
              ><label
                ><span>暂停补偿任务</span
                ><el-switch
                  v-model="faults.pauseOutbox"
                  aria-label="暂停补偿任务" /></label
              ><label class="delay-field"
                ><span>消费延迟（毫秒）</span
                ><el-input-number
                  v-model="faults.consumerDelayMs"
                  :min="0"
                  :max="30000"
                  :step="100"
                  aria-label="消费延迟毫秒"
              /></label>
            </div>
            <details class="advanced-faults">
              <summary>一次性故障窗口（高级）</summary>
              <p class="fine-print">
                仅对下一次任务生效，用于在数据库提交或 Redis
                回补之后暂停，验证进程中断恢复。
              </p>
              <div class="fault-grid">
                <label
                  ><span>DB 提交后暂停（毫秒）</span
                  ><el-input-number
                    v-model="faults.afterDbCommitPauseMs"
                    :min="0"
                    :max="30000"
                    :step="1000"
                    aria-label="数据库提交后暂停毫秒" /></label
                ><label
                  ><span>Redis 回补后暂停（毫秒）</span
                  ><el-input-number
                    v-model="faults.afterRedisApplyPauseMs"
                    :min="0"
                    :max="30000"
                    :step="1000"
                    aria-label="Redis回补后暂停毫秒"
                /></label>
              </div>
            </details>
            <div class="dialog-actions">
              <el-button :loading="busy" @click="saveFaults(true)"
                >恢复全部正常</el-button
              ><el-button type="primary" :loading="busy" @click="saveFaults()"
                >应用故障配置</el-button
              >
            </div>
          </div>
          <p v-else class="fine-print">当前环境未开放故障注入。</p></template
        >
      </section></template
    >
  </div>
  <el-dialog
    v-model="productDialog"
    :title="productId ? '编辑商品' : '新增商品'"
    width="560px"
    align-center
    ><form @submit.prevent="saveProduct">
      <label class="field-label" for="productName">商品名称</label
      ><el-input
        id="productName"
        v-model="productForm.name"
        maxlength="100"
      /><label class="field-label" for="productCategory">商品分类</label
      ><el-select id="productCategory" v-model="productForm.category" class="product-category-select">
        <el-option v-for="name in PRODUCT_CATEGORIES" :key="name" :label="name" :value="name" />
      </el-select><label class="field-label" for="productDescription">商品描述</label
      ><el-input
        id="productDescription"
        v-model="productForm.description"
        type="textarea"
        :rows="3"
        maxlength="600"
      /><label class="field-label" for="productImage">图片地址</label
      ><el-input
        id="productImage"
        v-model="productForm.imageUrl"
        placeholder="/assets/product-earbuds.png"
      /><label class="field-label" for="productPrice">原价（元）</label
      ><el-input-number
        id="productPrice"
        v-model="productForm.originalPrice"
        :min="0.01"
        :step="0.01"
        :precision="2"
        :max="1000000"
      /><el-alert
        v-if="formError"
        :title="formError"
        type="error"
        :closable="false"
        class="form-error"
      />
      <div class="dialog-actions form-footer">
        <el-button @click="productDialog = false">取消</el-button
        ><el-button type="primary" :loading="busy" native-type="submit"
          >保存商品</el-button
        >
      </div>
    </form></el-dialog
  >
  <el-dialog
    v-model="activityDialog"
    :title="activityId ? '编辑活动' : '创建活动'"
    width="780px"
    align-center
    ><form @submit.prevent="saveActivity">
      <div class="form-grid">
        <div>
          <label class="field-label" for="activityName">活动名称</label
          ><el-input
            id="activityName"
            v-model="activityForm.name"
            maxlength="100"
          />
        </div>
        <div>
          <label class="field-label" for="architecture">架构版本</label
          ><el-select
            id="architecture"
            v-model="activityForm.architectureVersion"
            ><el-option
              v-for="v in ['V0', 'V1', 'V2', 'V3', 'V4']"
              :key="v"
              :label="v === 'V4' ? 'V4 · 后续开发' : v"
              :value="v"
              :disabled="v === 'V4'"
          /></el-select>
        </div>
        <div>
          <label class="field-label" for="startTime">开始时间</label
          ><input
            id="startTime"
            v-model="activityForm.startTime"
            type="datetime-local"
            class="native-input"
            required
          />
        </div>
        <div>
          <label class="field-label" for="endTime">结束时间</label
          ><input
            id="endTime"
            v-model="activityForm.endTime"
            type="datetime-local"
            class="native-input"
            required
          />
        </div>
      </div>
      <label class="field-label" for="activityDescription">活动描述</label
      ><el-input
        id="activityDescription"
        v-model="activityForm.description"
        type="textarea"
        :rows="2"
      />
      <div class="section-heading form-section-heading">
        <h3>活动商品</h3>
        <el-button size="small" :icon="Plus" @click="addItem"
          >添加商品</el-button
        >
      </div>
      <div
        v-for="(item, index) in activityForm.items"
        :key="index"
        class="activity-item-form"
      >
        <div>
          <label class="field-label">商品</label
          ><el-select
            v-model="item.productId"
            :aria-label="'第' + (index + 1) + '项商品'"
            ><el-option
              v-for="p in products"
              :key="p.id"
              :label="p.name"
              :value="p.id"
          /></el-select>
        </div>
        <div>
          <label class="field-label">抢购价</label
          ><el-input-number
            v-model="item.seckillPrice"
            :min="0.01"
            :step="0.01"
            :precision="2"
            :controls="false"
            :aria-label="'第' + (index + 1) + '项抢购价'"
          />
        </div>
        <div>
          <label class="field-label">总库存</label
          ><el-input-number
            v-model="item.totalStock"
            :min="1"
            :max="1000000"
            :controls="false"
            :aria-label="'第' + (index + 1) + '项库存'"
          />
        </div>
        <div>
          <label class="field-label">每人限购</label
          ><el-input-number
            v-model="item.limitPerUser"
            :min="1"
            :max="100"
            :controls="false"
            :aria-label="'第' + (index + 1) + '项限购'"
          />
        </div>
        <el-button
          :icon="Delete"
          circle
          type="danger"
          plain
          :aria-label="'移除第' + (index + 1) + '项'"
          @click="activityForm.items.splice(index, 1)"
        />
      </div>
      <el-alert
        v-if="formError"
        :title="formError"
        type="error"
        :closable="false"
        class="form-error"
      />
      <p class="fine-print">
        活动开始预占后，库存、限购和架构版本将锁定。新实验请创建新活动。
      </p>
      <div class="dialog-actions">
        <el-button @click="activityDialog = false">取消</el-button
        ><el-button type="primary" :loading="busy" native-type="submit"
          >保存活动</el-button
        >
      </div>
    </form></el-dialog
  >
  <el-dialog
    v-model="experimentDialog"
    title="记录实验配置"
    width="600px"
    align-center
    ><form @submit.prevent="saveExperiment">
      <label class="field-label" for="experimentName">实验名称</label
      ><el-input
        id="experimentName"
        v-model="experimentForm.name"
        placeholder="例如：V3 · 200 用户正常负载"
      />
      <div class="form-grid">
        <div>
          <label class="field-label">版本</label
          ><el-select
            v-model="experimentForm.architectureVersion"
            aria-label="实验架构版本"
            ><el-option
              v-for="v in ['V0', 'V1', 'V2', 'V3', 'V4']"
              :key="v"
              :label="v === 'V4' ? 'V4 · 后续开发' : v"
              :value="v"
              :disabled="v === 'V4'"
          /></el-select>
        </div>
        <div>
          <label class="field-label">并发用户数</label
          ><el-input-number
            v-model="experimentForm.concurrency"
            :min="1"
            :max="100000"
            aria-label="并发用户数"
          />
        </div>
        <div>
          <label class="field-label">持续时间（秒）</label
          ><el-input-number
            v-model="experimentForm.durationSeconds"
            :min="1"
            :max="86400"
            aria-label="持续秒数"
          />
        </div>
        <div>
          <label class="field-label">配置库存</label
          ><el-input-number
            v-model="experimentForm.stock"
            :min="1"
            :max="10000000"
            aria-label="实验库存"
          />
        </div>
      </div>
      <label class="field-label" for="experimentNotes">环境 / 场景备注</label
      ><el-input
        id="experimentNotes"
        v-model="experimentForm.notes"
        type="textarea"
        :rows="3"
        placeholder="记录硬件、部署方式、测试场景和脚本版本"
      /><el-alert
        v-if="formError"
        :title="formError"
        type="error"
        :closable="false"
        class="form-error"
      />
      <div class="dialog-actions form-footer">
        <el-button @click="experimentDialog = false">取消</el-button
        ><el-button type="primary" :loading="busy" native-type="submit"
          >保存配置</el-button
        >
      </div>
    </form></el-dialog
  >
  <el-dialog
    v-model="resultsDialog"
    title="真实压测结果"
    width="760px"
    align-center
    ><p class="dialog-lead">
      选择测试脚本输出的 JSON，或粘贴真实结果。这里不会生成模拟性能数据。
    </p>
    <input
      type="file"
      accept=".json,application/json"
      aria-label="导入压测结果 JSON"
      class="file-input"
      @change="importFile"
    /><el-input
      v-model="resultsJson"
      type="textarea"
      :rows="15"
      aria-label="压测结果 JSON"
      placeholder="粘贴 JSON 结果"
    /><el-alert
      v-if="formError"
      :title="formError"
      type="error"
      :closable="false"
      class="form-error"
    /><template #footer
      ><el-button @click="resultsDialog = false">关闭</el-button
      ><el-button type="primary" :loading="busy" @click="saveResults"
        >保存真实结果</el-button
      ></template
    ></el-dialog
  >
</template>
