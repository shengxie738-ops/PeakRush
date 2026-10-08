/**
 * The portal's own auth transport. Deliberately NOT frontend/src/api.ts, for three
 * checkable reasons rather than any isolation rule: src/api.ts:20-21 attaches a stale
 * Authorization header to every call, and these two endpoints are unauthenticated;
 * src/api.ts:42 dispatches peakrush:expired, a main-app session event with no listener
 * in this document; and its status fallbacks are Chinese copy tuned to the main app.
 * Sharing a pure logic module across the two entries is fine — shared/safe-redirect.ts
 * does exactly that. Spec §4.1's isolation is document/CSS level, not JS level.
 *
 * Error text: the backend already answers in Chinese (ApiException.bad("用户名须为
 * 3–40位字母数字下划线…"), "用户名或密码不正确", "用户名已存在"), so its message is
 * passed through verbatim. Locally generated fallbacks use the same Chinese UI.
 */
export interface AuthUser {
  id: number;
  username: string;
  role: string;
}

export interface AuthResult {
  token: string;
  user: AuthUser;
}

export class AuthRequestError extends Error {
  constructor(
    message: string,
    public status = 0,
    public code = 'NETWORK_ERROR',
  ) {
    super(message);
    this.name = 'AuthRequestError';
  }
}

const TIMEOUT_MS = 18000;

const STATUS_FALLBACK: Record<number, string> = {
  400: '请检查填写的信息后重试。',
  401: '用户名或密码不正确。',
  403: '当前账号暂时无法完成此操作。',
  404: '服务暂时不可用，请稍后重试。',
  409: '该用户名已被使用，请换一个。',
  429: '操作过于频繁，请稍后重试。',
  503: '服务繁忙，请稍后重试。',
};

function isAbort(error: unknown): boolean {
  if (error instanceof DOMException && error.name === 'AbortError') return true;
  return error instanceof Error && error.name === 'AbortError';
}

export async function submitAuth(
  mode: 'signin' | 'signup',
  username: string,
  password: string,
): Promise<AuthResult> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(mode === 'signin' ? '/api/auth/login' : '/api/auth/register', {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: username.trim(), password }),
      signal: controller.signal,
    });
    const text = await response.text();
    let data: unknown = null;
    if (text) {
      try {
        data = JSON.parse(text);
      } catch {
        if (response.ok) {
          throw new AuthRequestError(
            '暂时无法读取服务响应，请重试。',
            response.status,
            'INVALID_RESPONSE',
          );
        }
      }
    }
    if (!response.ok) {
      const body = data as { message?: string; code?: string } | null;
      throw new AuthRequestError(
        body?.message || STATUS_FALLBACK[response.status] || '操作未完成，请重试。',
        response.status,
        body?.code || String(response.status),
      );
    }
    if (
      typeof data !== 'object' ||
      data === null ||
      typeof (data as AuthResult).token !== 'string' ||
      (data as AuthResult).token === '' ||
      typeof (data as AuthResult).user?.username !== 'string' ||
      typeof (data as AuthResult).user?.id !== 'number'
    ) {
      // `return data as AuthResult` alone would resolve a 200 carrying `{}` and let the
      // caller persist an undefined token, i.e. a login that is visibly broken.
      throw new AuthRequestError(
        '暂时无法获取登录状态，请重试。',
        response.status,
        'INVALID_RESPONSE',
      );
    }
    return data as AuthResult;
  } catch (error) {
    if (error instanceof AuthRequestError) throw error;
    const timedOut = isAbort(error);
    throw new AuthRequestError(
      timedOut
        ? '请求超时，请重试。'
        : '无法连接服务，请检查网络后重试。',
      0,
      timedOut ? 'TIMEOUT' : 'NETWORK_ERROR',
    );
  } finally {
    window.clearTimeout(timer);
  }
}
