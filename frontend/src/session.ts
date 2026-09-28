import { reactive } from "vue";
import { api } from "./api";
import type { User } from "./types";
let saved: User | null = null;
try {
  saved = JSON.parse(localStorage.getItem("peakrush.user") || "null");
} catch {
  localStorage.removeItem("peakrush.user");
}
export const session = reactive<{
  user: User | null;
  authOpen: boolean;
  authMessage: string;
}>({ user: saved, authOpen: false, authMessage: "" });
export function setSession(token: string, user: User) {
  localStorage.setItem("peakrush.token", token);
  localStorage.setItem("peakrush.user", JSON.stringify(user));
  session.user = user;
  session.authOpen = false;
  session.authMessage = "";
}
export function logout() {
  localStorage.removeItem("peakrush.token");
  localStorage.removeItem("peakrush.user");
  session.user = null;
}
export function requireLogin(message = "登录后，开启你的好物时刻。") {
  session.authMessage = message;
  session.authOpen = true;
}
export async function restoreSession() {
  if (!localStorage.getItem("peakrush.token")) {
    logout();
    return;
  }
  try {
    const user = await api<User>("/api/auth/me");
    session.user = user;
    localStorage.setItem("peakrush.user", JSON.stringify(user));
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      "status" in error &&
      error.status === 401
    )
      logout();
  }
}
window.addEventListener("peakrush:expired", () => {
  logout();
  requireLogin("登录已过期，请重新登录后继续。");
});
