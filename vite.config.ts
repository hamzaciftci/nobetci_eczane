import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

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
    }
  };
});

