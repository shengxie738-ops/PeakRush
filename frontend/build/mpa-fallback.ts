import type { Plugin } from 'vite';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { resolveEntry } from './resolve-entry';

/**
 * Serves the right MPA entry for deep links, in both `vite dev` and `vite preview`.
 *
 * Both hooks are required: scripts/app-start.ps1:62 starts the DEV server, while
 * `npm run preview` is the other documented way to serve this app. Mounting only one
 * of them would leave deep links 404-ing in the other.
 */
function rewrite(req: IncomingMessage, _res: ServerResponse, next: () => void): void {
  const url = req.url ?? '/';
  const qIndex = url.indexOf('?');
  const pathname = qIndex === -1 ? url : url.slice(0, qIndex);
  const entry = resolveEntry(pathname, req.headers.accept);
  if (entry === null) {
    next();
    return;
  }
  req.url = entry + (qIndex === -1 ? '' : url.slice(qIndex));
  next();
}

export function mpaFallback(): Plugin {
  return {
    name: 'peakrush-mpa-fallback',
    configureServer(server) {
      server.middlewares.use(rewrite);
    },
    configurePreviewServer(server) {
      server.middlewares.use(rewrite);
    },
  };
}
