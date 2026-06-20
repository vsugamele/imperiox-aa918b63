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
}

createRoot(document.getElementById("root")!).render(<App />);
