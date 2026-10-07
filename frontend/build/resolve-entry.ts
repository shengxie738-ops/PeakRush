/**
 * Decides which MPA entry serves a navigation request.
 *
 * Vite's appType:'mpa' turns off the SPA fallback, so a deep link into either app
 * would 404 on a direct load or a refresh. This is the whole decision, kept pure so
 * it can be tested without a server; mpa-fallback.ts only wires it into middlewares.
 *
 * Returning null means "leave the request alone" — it is a static asset, an internal
 * Vite/dev URL, an API proxy path, or not an HTML navigation at all.
 */
const RESERVED_PREFIXES = [
  '/src/',
  '/welcome/',
  '/assets/',
  '/fonts/',
  '/_app/',
  '/@',
  '/node_modules/',
  '/api',
  '/actuator',
] as const;

export function resolveEntry(pathname: string, accept: string | undefined): string | null {
  if (!accept || !accept.includes('text/html')) return null;
  if (RESERVED_PREFIXES.some((prefix) => pathname.startsWith(prefix))) return null;
  const lastSegment = pathname.slice(pathname.lastIndexOf('/') + 1);
  if (lastSegment.includes('.')) return null;
  const isApp = pathname === '/app' || pathname.startsWith('/app/');
  return isApp ? '/app.html' : '/index.html';
}
