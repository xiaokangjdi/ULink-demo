import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// The /api proxy target is overridable so a second dev server can point at the
// isolated temporary TW-FS experiment backend (:8010) without changing the
// default behaviour. Default stays :8000 (the original demo backend).
//   default              -> http://127.0.0.1:8000
//   MTLINK_API_TARGET=... -> e.g. http://127.0.0.1:8010
const apiTarget = process.env.MTLINK_API_TARGET || "http://127.0.0.1:8000";

export default defineConfig({
  base: "/ULink-demo/",
  plugins: [react()],
  server: {
    port: 5183,
    proxy: {
      "/api": {
        target: apiTarget,
        changeOrigin: true,
      },
    },
  },
});
