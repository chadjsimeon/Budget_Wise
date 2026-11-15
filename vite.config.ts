import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";
import path from "path";
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.svg", "favicon-16.png", "favicon-32.png", "favicon-180.png"],
      manifest: {
        name: "WantNot",
        short_name: "WantNot",
        description:
          "A powerful zero-based budgeting application to take control of your finances.",
        theme_color: "#0f172a",
        background_color: "#0f172a",
        display: "standalone",
        start_url: "/",
        scope: "/",
        icons: [
          { src: "pwa-192x192.png", sizes: "192x192", type: "image/png" },
          { src: "pwa-512x512.png", sizes: "512x512", type: "image/png" },
          {
            src: "pwa-512x512-maskable.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
      // No runtime caching of /api responses: the persisted Zustand store is
      // the offline copy of the user's data. A second copy in the service
      // worker cache went stale, overwrote newer local state on offline
      // start-up, and outlived logout.
    }),
  ],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "client", "src"),
      "@shared": path.resolve(import.meta.dirname, "shared"),
      "@assets": path.resolve(import.meta.dirname, "attached_assets"),
    },
  },
  css: {
    postcss: {
      plugins: [],
    },
  },
  root: path.resolve(import.meta.dirname, "client"),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
  },
  server: {
    host: "0.0.0.0",
    allowedHosts: true,
    fs: {
      strict: true,
      deny: ["**/.*"],
    },
  },
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: [path.resolve(import.meta.dirname, "client", "src", "test", "setup.ts")],
    css: false,
    // Discover both client specs and the server specs (which opt into the node
    // environment per-file). Paths are relative to the vite root (client/).
    include: ["./src/**/*.{test,spec}.{ts,tsx}", "../server/**/*.{test,spec}.ts"],
    // The server data layer constructs a pg Pool at import time (lazy — no
    // connection until a query), so a placeholder URL is enough for unit tests.
    env: {
      DATABASE_URL:
        process.env.DATABASE_URL ||
        "postgresql://test:test@localhost:5432/test",
    },
  },
});
