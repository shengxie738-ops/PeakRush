<script setup lang="ts">
import { reactive, ref, watch } from "vue";
import { session, setSession } from "../session";
import { post, errorMessage } from "../api";
import type { User } from "../types";
const mode = ref<"login" | "register">("login"),
  busy = ref(false),
  error = ref("");
const form = reactive({ username: "", password: "", confirm: "" });
watch(
  () => session.authOpen,
  () => {
    error.value = "";
    form.password = "";
    form.confirm = "";
  },
);
watch(mode, () => (error.value = ""));
async function submit() {
  if (busy.value) return;
  error.value = "";
  if (form.username.trim().length < 3) {
    error.value = "请输入至少 3 位的用户名。";
    return;
  }
  if (form.password.length < 6) {
    error.value = "密码至少需要 6 位。";
    return;
  }
  if (mode.value === "register" && form.password !== form.confirm) {
    error.value = "两次输入的密码不一致。";
    return;
  }
  busy.value = true;
  try {
    const data = await post<{ token: string; user: User }>(
      "/api/auth/" + mode.value,
      { username: form.username.trim(), password: form.password },
    );
    setSession(data.token, data.user);
  } catch (e) {
    error.value = errorMessage(e);
  } finally {
    busy.value = false;
  }
}
</script>
<template>
  <el-dialog
    v-model="session.authOpen"
    :title="mode === 'login' ? '欢迎回到 PeakRush' : '开启你的好物时刻'"
    width="440px"
    class="auth-dialog"
    align-center
    :close-on-click-modal="!busy"
    ><p class="dialog-lead">
      {{ session.authMessage || "限量好物，值得准点相遇。" }}
    </p>
    <div class="auth-tabs">
      <button :class="{ selected: mode === 'login' }" @click="mode = 'login'">
        账号登录</button
      ><button
        :class="{ selected: mode === 'register' }"
        @click="mode = 'register'"
      >
        注册账号
      </button>
    </div>
    <form @submit.prevent="submit">
      <label class="field-label" for="username">用户名</label
      ><el-input
        id="username"
        v-model="form.username"
        autocomplete="username"
        maxlength="40"
        placeholder="输入用户名"
        size="large"
      /><label class="field-label" for="password">密码</label
      ><el-input
        id="password"
        v-model="form.password"
        type="password"
        show-password
        :autocomplete="mode === 'login' ? 'current-password' : 'new-password'"
        placeholder="至少 6 位字符"
        size="large"
      /><template v-if="mode === 'register'"
        ><label class="field-label" for="confirm">确认密码</label
        ><el-input
          id="confirm"
          v-model="form.confirm"
          type="password"
          show-password
          autocomplete="new-password"
          placeholder="再次输入密码"
          size="large" /></template
      ><el-alert
        v-if="error"
        :title="error"
        type="error"
        :closable="false"
        show-icon
        class="form-error"
      /><el-button
        class="wide-button auth-submit"
        type="primary"
        size="large"
        native-type="submit"
        :loading="busy"
        >{{ mode === "login" ? "登录，去发现好物" : "注册并登录" }}</el-button
      >
    </form>
    <p class="fine-print">仅用于课程演示，不接入真实支付。</p></el-dialog
  >
</template>
