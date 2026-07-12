import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { VitePWA } from "vite-plugin-pwa";
import { visualizer } from "rollup-plugin-visualizer";


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
    mode === "production" && visualizer({
      filename: "dist/stats.html",
      gzipSize: true,
      brotliSize: true,
      template: "treemap",
    }),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    dedupe: ["react", "react-dom"],
  },
  build: {
    rollupOptions: {
      output: {
        // Split heavy vendors into cacheable chunks. Page-level lazy imports
        // become smaller too because shared libs no longer duplicate inside each route chunk.
        manualChunks: {
          "vendor-react": ["react", "react-dom", "react-router-dom"],
          "vendor-radix": [
            "@radix-ui/react-dialog",
            "@radix-ui/react-dropdown-menu",
            "@radix-ui/react-popover",
            "@radix-ui/react-select",
            "@radix-ui/react-tabs",
            "@radix-ui/react-tooltip",
            "@radix-ui/react-accordion",
            "@radix-ui/react-alert-dialog",
            "@radix-ui/react-scroll-area",
            "@radix-ui/react-toast",
          ],
          "vendor-charts": ["recharts"],
          "vendor-flow": ["@xyflow/react"],
          "vendor-motion": ["framer-motion"],
          "vendor-pdf": ["jspdf", "jspdf-autotable", "jszip", "html-to-image"],
          "vendor-supabase": ["@supabase/supabase-js"],
          "vendor-query": ["@tanstack/react-query"],
          "vendor-markdown": ["react-markdown", "remark-gfm"],
          "vendor-icons": ["lucide-react"],
        },
      },
    },
  },
}));
