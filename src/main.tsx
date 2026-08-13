import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// PWA guard: prevent service worker / cache issues in iframe / Lovable preview contexts.
// The Lovable editor renders the app inside an iframe; if a previously-registered SW
// keeps serving an old bundle, new routes (e.g. /gerenciador, /cohort, /recuperacao)
// 404 because the cached JS does not know them.
const isInIframe = (() => {
  try {
    return window.self !== window.top;
  } catch (e) {
    return true;
  }
})();

const host = window.location.hostname;
// Only nuke SW in Lovable editor preview hosts — NOT on the published domain,
// otherwise push notifications never reach the user's phone.
const isPreviewHost =
  host.includes("id-preview--") ||
  host.includes("lovableproject.com");

if (isPreviewHost || isInIframe) {
  // Unregister any existing service worker.
  navigator.serviceWorker?.getRegistrations().then((registrations) => {
    registrations.forEach((r) => r.unregister().catch(() => {}));
  });
  // Wipe all caches so a stale precache does not serve an old index.html / JS bundle.
  if (typeof caches !== "undefined" && caches?.keys) {
    caches.keys().then((keys) => keys.forEach((k) => caches.delete(k).catch(() => {}))).catch(() => {});
  }
} else if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw-push.js", { scope: "/" }).catch((err) => {
      console.warn("[push] service worker registration failed", err);
    });
  });
}

// Auto-recover from stale chunk references after a deploy.
// When a new build is shipped, the old index.html in memory still points to
// hashed chunks that no longer exist -> "Importing a module script failed".
// Reload once to fetch the fresh index.html + new chunk hashes.
const RELOAD_FLAG = "__chunk_reload_at";
function isChunkLoadError(msg: string) {
  return /Importing a module script failed|Failed to fetch dynamically imported module|Loading chunk \d+ failed|ChunkLoadError/i.test(msg);
}
function tryRecover(msg: string) {
  if (!isChunkLoadError(msg)) return;
  const last = Number(sessionStorage.getItem(RELOAD_FLAG) || 0);
  if (Date.now() - last < 10_000) return; // avoid reload loops
  sessionStorage.setItem(RELOAD_FLAG, String(Date.now()));
  if (typeof caches !== "undefined" && caches?.keys) {
    caches.keys().then((keys) => Promise.all(keys.map((k) => caches.delete(k)))).finally(() => window.location.reload());
  } else {
    window.location.reload();
  }
}
window.addEventListener(
  "error",
  (e) => {
    // Resource load errors (e.g. <script src="/assets/vendor-react-XXX.js"> 404 after deploy)
    // come through as ErrorEvents with an empty message but a target pointing at the element.
    const target = e?.target as HTMLElement | null;
    if (target && (target.tagName === "SCRIPT" || target.tagName === "LINK")) {
      const src = (target as HTMLScriptElement).src || (target as HTMLLinkElement).href || "";
      if (/\/assets\/.+\.(js|css)/.test(src)) {
        tryRecover("Importing a module script failed");
        return;
      }
    }
    tryRecover(e?.message || "");
  },
  true, // capture: resource errors don't bubble
);
window.addEventListener("unhandledrejection", (e) => tryRecover(String((e as any)?.reason?.message || (e as any)?.reason || "")));

createRoot(document.getElementById("root")!).render(<App />);
