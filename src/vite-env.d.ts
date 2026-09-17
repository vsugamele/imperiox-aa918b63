/// <reference types="vite/client" />

// Injected by vite.config.ts `define` at build time (ISO timestamp).
declare const __APP_BUILD__: string;

interface Window {
  __APP_BUILD__?: string;
}
