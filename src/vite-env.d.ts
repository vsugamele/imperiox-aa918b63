/// <reference types="vite/client" />

// Injected by vite.config.ts `define` at build time (ISO timestamp).
declare const __APP_BUILD__: string;
// Commit do build (VERCEL_GIT_COMMIT_SHA); vazio em build local.
declare const __APP_COMMIT__: string;

interface Window {
  __APP_BUILD__?: string;
}
