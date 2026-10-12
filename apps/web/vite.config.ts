import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "prompt",
      strategies: "injectManifest",   // custom SW for push + background sync
      srcDir: "src",
      filename: "sw.ts",
      manifest: {
        name: "Tatakae",
        short_name: "Tatakae",
        description: "Plan the night before. Start strict. Show up.", // laptop website; the phone uses apps/mobile
        theme_color: "#F1F1EF",
        background_color: "#F1F1EF",
        display: "standalone",
        start_url: "/",
        // Share text or a link from another app into the inbox (Chromium desktop PWAs).
        share_target: { action: "/capture", method: "GET", params: { title: "title", text: "text", url: "url" } },
        icons: [
          // Original mark (scripts/make-icons.mjs): charcoal tile, three rising steps. No franchise imagery.
          { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
          { src: "/icon-maskable.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
    }),
  ],
  server: { proxy: { "/api": "http://localhost:8787" } }, // prod: Caddy serves dist + proxies /api
});
