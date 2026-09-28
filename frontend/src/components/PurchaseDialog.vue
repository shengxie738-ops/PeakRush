<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from "vue";
import { useRouter } from "vue-router";
import {
  ArrowRight,
  CircleCheck,
  Clock,
  Warning,
} from "@element-plus/icons-vue";
import { api, post, ApiError, errorMessage } from "../api";
import { session, requireLogin } from "../session";
import { money, dateTime, productImage } from "../format";
import type { Activity, Item, PurchaseResult } from "../types";
const props = defineProps<{
    modelValue: boolean;
    activity: Activity;
    item: Item;
  }>(),
  emit = defineEmits(["update:modelValue", "changed"]);
const router = useRouter(),
  quantity = ref(1),
  busy = ref(false),
  error = ref(""),
  result = ref<PurchaseResult | null>(null),
  waiting = ref(false),
  uncertain = ref(false);
const open = computed({
  get: () => props.modelValue,
  set: (v) => emit("update:modelValue", v),
});
let timer: number | undefined;
let clockTimer: number | undefined;
const clock = ref(Date.now());
let started = 0;
let key = "";
let issuedPath = "";
let generation = 0;
const storageKey = () =>
  "peakrush.attempt." +
  (session.user?.id || "guest") +
  "." +
  props.activity.id +
  "." +
  props.item.id;
const terminal = computed(
  () => result.value && result.value.status !== "PENDING",
);
const total = computed(() => Number(props.item.seckillPrice) * quantity.value);
const availabilityMessage = computed(() => {
  const activity = props.activity;
  if (activity.status === "OFFLINE" || activity.status === "DRAFT")
    return "本场活动暂不可购买";
  if (
    activity.status === "ENDED" ||
    clock.value >= new Date(activity.endTime).getTime()
  )
    return "本场活动已结束";
  if (
    clock.value < new Date(activity.startTime).getTime() ||
    activity.status === "PREHEATED"
  )
    return "好物即将开抢，请准点回来";
  if (activity.status === "SOLD_OUT" || props.item.availableStock === 0)
    return "这件好物本场已抢光";
  return "";
});
function assertResult(value: PurchaseResult): void {
  if (
    !value ||
    typeof value.requestId !== "string" ||
    ![
      "PENDING",
      "SUCCESS",
      "SOLD_OUT",
      "FAILED",
      "CLOSED",
      "CANCELLED",
    ].includes(value.status)
  )
    throw new ApiError(
      "暂时无法确认服务器返回的抢购结果，请继续查询。",
      0,
      "INVALID_RESPONSE",
    );
}
function stop() {
  generation++;
  if (timer) window.clearTimeout(timer);
  if (clockTimer) window.clearInterval(clockTimer);
  timer = undefined;
  clockTimer = undefined;
  waiting.value = false;
  busy.value = false;
}
async function checkResult() {
  if (!result.value?.requestId || !open.value) return;
  const run = generation,
    requestId = result.value.requestId,
    slot = storageKey();
  try {
    const response = await api<PurchaseResult>(
      "/api/seckill/result/" + requestId,
    );
    assertResult(response);
    if (run !== generation || !open.value) return;
    result.value = response;
    error.value = "";
    if (response.status === "PENDING") {
      if (Date.now() - started < 120000) {
        waiting.value = true;
        timer = window.setTimeout(checkResult, 2000);
      } else {
        waiting.value = false;
        error.value =
          "订单还在处理中。可手动刷新结果，或稍后在我的订单中查看。";
      }
    } else {
      stop();
      localStorage.removeItem(slot);
      emit("changed");
    }
  } catch (e) {
    if (run === generation) {
      waiting.value = false;
      error.value = errorMessage(e);
    }
  }
}
function refresh() {
  if (timer) window.clearTimeout(timer);
  started = Date.now();
  waiting.value = true;
  checkResult();
}
async function submit() {
  clock.value = Date.now();
  if (!uncertain.value && availabilityMessage.value) {
    error.value = availabilityMessage.value;
    return;
  }
  if (!session.user) {
    requireLogin("登录后即可参与本场抢购。");
    return;
  }
  if (busy.value) return;
  busy.value = true;
  error.value = "";
  if (!key) key = crypto.randomUUID();
  const run = generation,
    slot = storageKey(),
    requestKey = key,
    requestQuantity = quantity.value,
    activityId = props.activity.id,
    itemId = props.item.id,
    wasUncertain = uncertain.value;
  localStorage.setItem(
    slot,
    JSON.stringify({
      key: requestKey,
      quantity: requestQuantity,
      requestId: "",
      path: issuedPath,
    }),
  );
  let purchaseSent = false;
  try {
    const requestPath =
      issuedPath ||
      (
        await post<{ path: string }>(
          "/api/seckill/" + activityId + "/" + itemId + "/path",
        )
      ).path;
    if (run !== generation) return;
    issuedPath = requestPath;
    localStorage.setItem(
      slot,
      JSON.stringify({
        key: requestKey,
        quantity: requestQuantity,
        requestId: "",
        path: requestPath,
      }),
    );
    purchaseSent = true;
    const response = await post<PurchaseResult>(
      "/api/seckill/" +
        encodeURIComponent(requestPath) +
        "/" +
        activityId +
        "/" +
        itemId,
      { quantity: requestQuantity },
      { "Idempotency-Key": requestKey },
    );
    assertResult(response);
    if (response.status === "PENDING")
      localStorage.setItem(
        slot,
        JSON.stringify({
          key: requestKey,
          quantity: requestQuantity,
          requestId: response.requestId,
          path: requestPath,
        }),
      );
    else localStorage.removeItem(slot);
    if (run !== generation || !open.value) return;
    result.value = response;
    uncertain.value = false;
    if (response.status === "PENDING") refresh();
    else emit("changed");
  } catch (e) {
    if (run !== generation) return;
    error.value = errorMessage(e);
    uncertain.value =
      wasUncertain ||
      (purchaseSent &&
        (!(e instanceof ApiError) ||
          e.status === 0 ||
          e.status >= 500 ||
          e.code === "INVALID_RESPONSE"));
    if (!uncertain.value) {
      key = "";
      issuedPath = "";
      localStorage.removeItem(slot);
    }
  } finally {
    if (run === generation) busy.value = false;
  }
}
function reset() {
  stop();
  clock.value = Date.now();
  clockTimer = window.setInterval(() => (clock.value = Date.now()), 1000);
  quantity.value = 1;
  key = "";
  issuedPath = "";
  result.value = null;
  error.value = "";
  uncertain.value = false;
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey()) || "null");
    if (
      saved &&
      typeof saved.key === "string" &&
      Number.isInteger(saved.quantity) &&
      saved.quantity > 0
    ) {
      key = saved.key;
      issuedPath = typeof saved.path === "string" ? saved.path : "";
      quantity.value = saved.quantity;
      uncertain.value = true;
      if (saved.requestId) {
        result.value = { requestId: saved.requestId, status: "PENDING" };
        refresh();
      }
    }
  } catch {
    localStorage.removeItem(storageKey());
  }
}
watch(
  () => props.modelValue,
  (v) => {
    if (v) reset();
    else stop();
  },
  { immediate: true },
);
watch(
  () => [props.activity.id, props.item.id, session.user?.id],
  () => {
    if (open.value) reset();
  },
);
onUnmounted(stop);
function seeOrder() {
  open.value = false;
  router.push({
    path: "/orders",
    query: result.value?.orderId
      ? { orderId: result.value.orderId }
      : undefined,
  });
}
</script>
<template>
  <el-dialog
    v-model="open"
    title="把心动带回家"
    width="560px"
    align-center
    :close-on-click-modal="!busy"
    @closed="stop"
    ><div class="purchase-product">
      <img :src="productImage(item.imageUrl)" :alt="item.name" />
      <div>
        <small>{{ activity.name }}</small>
        <h2>{{ item.name }}</h2>
        <p class="accent-price">
          ¥{{ money(item.seckillPrice) }}
          <del>¥{{ money(item.originalPrice) }}</del>
        </p>
      </div>
    </div>
    <p class="purchase-description">{{ item.description }}</p>
    <div v-if="!result" class="purchase-fields">
      <div>
        <span>购买数量</span
        ><el-input-number
          v-model="quantity"
          :min="1"
          :max="item.limitPerUser"
          :disabled="busy || uncertain"
          aria-label="购买数量"
          @change="
            key = '';
            issuedPath = '';
          "
        />
      </div>
      <p>每人限购 {{ item.limitPerUser }} 件，每件商品每场仅可下一单。</p>
      <div>
        <span>活动时间</span
        ><strong
          >{{ dateTime(activity.startTime) }} —
          {{ dateTime(activity.endTime) }}</strong
        >
      </div>
      <div class="total-line">
        <span>合计</span><strong>¥{{ money(total) }}</strong>
      </div>
    </div>
    <div v-else class="purchase-result" aria-live="polite">
      <el-icon
        :size="40"
        :class="result.status === 'SUCCESS' ? 'success-icon' : 'result-icon'"
        ><CircleCheck v-if="result.status === 'SUCCESS'" /><Clock
          v-else-if="result.status === 'PENDING'" /><Warning v-else
      /></el-icon>
      <h3>
        {{
          {
            PENDING: "正在为你确认好物",
            SUCCESS: "抢购成功，好物为你保留",
            SOLD_OUT: "这件好物已经抢光了",
            FAILED: "这次未能抢购成功",
            CLOSED: "这笔订单已超时关闭",
            CANCELLED: "这笔订单已取消",
          }[result.status]
        }}
      </h3>
      <p>
        {{
          result.message ||
          (result.status === "PENDING"
            ? "请求已收到，请稍等片刻。无需重复提交。"
            : result.status === "SUCCESS"
              ? "请在订单有效期内完成模拟支付。"
              : "可以返回活动，看看其他好物。")
        }}
      </p>
      <small class="request-reference">受理编号 {{ result.requestId }}</small>
    </div>
    <el-alert
      v-if="!result && !uncertain && availabilityMessage"
      :title="availabilityMessage"
      type="info"
      :closable="false"
      class="form-error"
    /><el-alert
      v-if="error"
      :title="error"
      :type="uncertain ? 'warning' : 'error'"
      show-icon
      :closable="false"
      class="form-error"
    /><el-alert
      v-if="uncertain && !error && !result"
      title="发现上一次尚未确认的请求。继续查询会复用同一次抢购，不会重复提交。"
      type="info"
      :closable="false"
      class="form-error"
    /><template #footer
      ><div class="dialog-actions">
        <el-button @click="open = false">{{
          result?.status === "PENDING" ? "稍后查看" : "返回"
        }}</el-button
        ><el-button
          v-if="!result"
          type="primary"
          :loading="busy"
          :disabled="!uncertain && !!availabilityMessage"
          @click="submit"
          >{{
            !session.user
              ? "登录并抢购"
              : uncertain
                ? "继续确认这次抢购"
                : "确认抢购 · ¥" + money(total)
          }}</el-button
        ><el-button
          v-else-if="result.status === 'PENDING'"
          :loading="waiting"
          type="primary"
          @click="refresh"
          >刷新结果</el-button
        ><el-button
          v-else-if="terminal && result.orderId"
          type="primary"
          :icon="ArrowRight"
          @click="seeOrder"
          >查看订单</el-button
        >
      </div></template
    ></el-dialog
  >
</template>
