export class ApiError extends Error {
  constructor(
    message: string,
    public status = 0,
    public code = "NETWORK_ERROR",
  ) {
    super(message);
    this.name = "ApiError";
  }
}
export async function api<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 18000);
  const headers = new Headers(options.headers);
  headers.set("Accept", "application/json");
  if (options.body) headers.set("Content-Type", "application/json");
  const token = localStorage.getItem("peakrush.token");
  if (token) headers.set("Authorization", "Bearer " + token);
  try {
    const response = await fetch(path, {
      ...options,
      headers,
      signal: options.signal || controller.signal,
    });
    const text = await response.text();
    let data: unknown = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      if (response.ok)
        throw new ApiError(
          "服务返回了无法识别的数据，请稍后重试。",
          response.status,
          "INVALID_RESPONSE",
        );
    }
    if (!response.ok) {
      const error = data as { message?: string; code?: string } | null;
      if (response.status === 401 && !path.startsWith("/api/auth/"))
        window.dispatchEvent(new Event("peakrush:expired"));
      throw new ApiError(
        error?.message ||
          {
            401: "登录已过期，请重新登录。",
            403: "你没有执行此操作的权限。",
            404: "内容暂不存在。",
            429: "请求有点频繁，请稍后再试。",
            503: "服务暂时繁忙，请稍后再试。",
          }[response.status] ||
          "操作未完成，请稍后重试。",
        response.status,
        error?.code || String(response.status),
      );
    }
    return data as T;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(
      error instanceof DOMException && error.name === "AbortError"
        ? "连接超时。你可以安全重试，我们会继续查询同一次抢购。"
        : "暂时无法连接服务，请检查网络后重试。",
    );
  } finally {
    window.clearTimeout(timeout);
  }
}
export const post = <T>(path: string, body?: unknown, headers?: HeadersInit) =>
  api<T>(path, {
    method: "POST",
    body: body === undefined ? undefined : JSON.stringify(body),
    headers,
  });
export const errorMessage = (error: unknown) =>
  error instanceof Error ? error.message : "操作未完成，请重试。";
