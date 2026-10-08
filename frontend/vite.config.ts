import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import { mpaFallback } from "./build/mpa-fallback";

export default defineConfig({
  plugins: [vue(), mpaFallback()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./welcome", import.meta.url)),
      "@shared": fileURLToPath(new URL("./shared", import.meta.url)),
    },
  },
  // 'spa' would fall every unknown path back to /index.html, which would serve the
  // clone for /app/orders. mpaFallback() owns that decision instead.
  appType: "mpa",
  server: {
    host: "127.0.0.1",
    port: 5400,
    strictPort: true,
    proxy: {
      "/api": { target: "http://127.0.0.1:8080", changeOrigin: true },
      "/actuator": { target: "http://127.0.0.1:8080", changeOrigin: true },
    },
  },
  build: {
    // Not the default 'assets': publicDir also holds the clone's 23MB public/assets/,
    // and both would land in dist/assets/. Filenames do not actually collide (Vite
    // hashes its own), but keeping them apart makes a broken asset obvious.
    assetsDir: "_app",
    target: "es2022",
    chunkSizeWarningLimit: 1200,
    rollupOptions: {
      input: {
        index: fileURLToPath(new URL("./index.html", import.meta.url)),
        app: fileURLToPath(new URL("./app.html", import.meta.url)),
      },
    },
  },
});
