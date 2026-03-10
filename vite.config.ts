import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
// vitest type augmentation
/// <reference types="vitest" />

export default defineConfig(() => {
  const apiTarget = (process.env.VITE_API_PROXY_TARGET || "").trim();

  return {
    server: {
      host: "::",
      port: 8080,
      hmr: {
        overlay: false
      },
      ...(apiTarget
        ? {
            proxy: {
              "/api": {
                target: apiTarget,
                changeOrigin: true
              }
            }
          }
        : {})
    },
    plugins: [react()],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src")
      }
    },
    test: {
      // Node ortamı — API katmanı (no DOM)
      environment: "node",
      // Test dosyaları sadece tests/ dizininden
      include: ["tests/**/*.test.{js,ts}", "tests/**/*.spec.{js,ts}"],
      // Global API'leri inject et (describe, it, expect)
      globals: true,
      // Coverage
      coverage: {
        provider:  "v8",
        reporter:  ["text", "json-summary"],
        include:   ["api/_lib/**"],
        exclude:   ["api/_lib/db.js"],
      }
    }
  };
});

