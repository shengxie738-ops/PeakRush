/**
 * The only place that decides where a post-login navigation may go.
 *
 * `redirect` comes from a query string, so it is attacker-controlled, and it is handed
 * straight to window.location.href — which happily accepts absolute URLs. Both entries
 * import this one copy on purpose: duplicating a security check is how one side gets
 * fixed and the other stays open.
 *
 * Only same-origin paths under /app are allowed. There is no legitimate reason to land
 * a freshly authenticated user on one of the portal's marketing routes, so everything
 * else — including same-origin '/' and '/signin' — falls back.
 */
export function safeRedirect(value: unknown, fallback = '/app/'): string {
  if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//')) return fallback;
  if (/[\\\u0000-\u0020]/.test(value)) return fallback;
  try {
    // Check the browser-normalized path as well: /app/../signin escapes /app.
    const url = new URL(value, 'https://peakrush.invalid');
    const isAppPath = url.pathname === '/app' || url.pathname.startsWith('/app/');
    return url.origin === 'https://peakrush.invalid' && isAppPath ? value : fallback;
  } catch {
    return fallback;
  }
}
