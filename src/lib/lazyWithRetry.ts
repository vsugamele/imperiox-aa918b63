import { lazy, type ComponentType } from "react";

const RELOAD_KEY = "__chunk_retry_at";

/**
 * React.lazy with resilience against stale chunk hashes after a deploy.
 * 1st failure: retry the import once (transient network / CDN warm-up).
 * 2nd failure: the hashed file really is gone -> clear caches and hard-reload
 * index.html once (guarded against reload loops).
 */
export function lazyWithRetry<T extends ComponentType<any>>(
  factory: () => Promise<{ default: T }>,
) {
  return lazy(async () => {
    try {
      return await factory();
    } catch (err) {
      await new Promise((r) => setTimeout(r, 400));
      try {
        return await factory();
      } catch (err2) {
        const last = Number(sessionStorage.getItem(RELOAD_KEY) || 0);
        if (Date.now() - last > 15_000) {
          sessionStorage.setItem(RELOAD_KEY, String(Date.now()));
          try {
            if (typeof caches !== "undefined" && caches?.keys) {
              const keys = await caches.keys();
              await Promise.all(keys.map((k) => caches.delete(k)));
            }
            if ("serviceWorker" in navigator) {
              const regs = await navigator.serviceWorker.getRegistrations();
              await Promise.all(regs.map((r) => r.unregister()));
            }
          } catch {
            /* ignore */
          }
          // Cache-bust index.html so the browser/CDN cannot hand back the old
          // document that references the missing chunk.
          const url = new URL(window.location.href);
          url.searchParams.set("_r", String(Date.now()));
          window.location.replace(url.toString());
          // Keep Suspense pending while the reload happens.
          return await new Promise<{ default: T }>(() => {});
        }
        throw err2;
      }
    }
  });
}
