import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { VitePWA } from "vite-plugin-pwa";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [
    react(),
    mode === "development" && componentTagger(),
    VitePWA({
      strategies: "injectManifest",
      srcDir: "public",
      filename: "sw-push.js",
      registerType: "autoUpdate",
      devOptions: { enabled: false },
      injectManifest: {
        // SW does not call precacheAndRoute anymore; keep an empty glob to avoid
        // injecting a stale precache manifest that would freeze old SPA routes.
        globPatterns: [],
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        injectionPoint: undefined,
      },
      manifest: false,
    }),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    dedupe: ["react", "react-dom"],
  },
}));
