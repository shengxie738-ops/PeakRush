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
 * passed through verbatim rather than re-worded. Chinese copy on an otherwise English
 * page is expected in sub-project 1 and gets fixed wholesale by sub-project 2. Only
 * the locally-generated fallbacks are English.
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
  400: 'The form was rejected. Check the fields and try again.',
  401: 'Incorrect username or password.',
  403: 'You are not allowed to do that.',
  404: 'That endpoint does not exist.',
  409: 'That username is already taken.',
  429: 'Too many attempts. Wait a moment and try again.',
  503: 'The service is busy. Try again shortly.',
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
            'The server sent something unreadable. Try again.',
            response.status,
            'INVALID_RESPONSE',
          );
        }
      }
    }
    if (!response.ok) {
      const body = data as { message?: string; code?: string } | null;
      throw new AuthRequestError(
        body?.message || STATUS_FALLBACK[response.status] || 'That did not work. Try again.',
        response.status,
        body?.code || String(response.status),
      );
    }
    return data as AuthResult;
  } catch (error) {
    if (error instanceof AuthRequestError) throw error;
    const timedOut = isAbort(error);
    throw new AuthRequestError(
      timedOut
        ? 'The request timed out. It is safe to try again.'
        : 'Cannot reach the service. Check the connection and try again.',
      0,
      timedOut ? 'TIMEOUT' : 'NETWORK_ERROR',
    );
  } finally {
    window.clearTimeout(timer);
  }
}
