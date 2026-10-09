import { reactive } from "vue";
import { api } from "./api";
import type { User } from "./types";
let saved: User | null = null;
let sessionToken = localStorage.getItem("peakrush.token");
let authenticationRedirectStarted = false;
try {
  saved = sessionToken
    ? JSON.parse(localStorage.getItem("peakrush.user") || "null")
    : null;
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
  sessionToken = token;
  session.user = user;
  session.authOpen = false;
  session.authMessage = "";
  authenticationRedirectStarted = false;
}
export function logout() {
  localStorage.removeItem("peakrush.token");
  localStorage.removeItem("peakrush.user");
  sessionToken = null;
  session.user = null;
}
export function requireLogin(
  message = "登录后，开启你的好物时刻。",
  reason?: "expired",
) {
  if (authenticationRedirectStarted) return;
  authenticationRedirectStarted = true;
  session.authMessage = message;
  try {
    sessionStorage.setItem("peakrush.authMessage", message);
  } catch {
    // The login page remains reachable when browser storage is unavailable.
  }
  const back =
    window.location.pathname + window.location.search + window.location.hash;
  const target = "/signin?redirect=" + encodeURIComponent(back);
  window.location.assign(target + (reason ? "&reason=" + reason : ""));
}
export async function restoreSession() {
  const token = localStorage.getItem("peakrush.token");
  if (!token) {
    logout();
    return;
  }
  if (token !== sessionToken) {
    sessionToken = token;
    session.user = null;
  }
  try {
    const user = await api<User>("/api/auth/me");
    if (token !== sessionToken || token !== localStorage.getItem("peakrush.token"))
      return;
    session.user = user;
    localStorage.setItem("peakrush.user", JSON.stringify(user));
  } catch (error) {
    if (token !== sessionToken || token !== localStorage.getItem("peakrush.token"))
      return;
    if (
      error &&
      typeof error === "object" &&
      "status" in error &&
      error.status === 401
    ) {
      logout();
      requireLogin("登录已过期，请重新登录后继续。", "expired");
    }
  }
}
window.addEventListener("peakrush:expired", () => {
  logout();
  requireLogin("登录已过期，请重新登录后继续。", "expired");
});
window.addEventListener("pageshow", (event) => {
  authenticationRedirectStarted = false;
  if (event.persisted) void restoreSession();
});
