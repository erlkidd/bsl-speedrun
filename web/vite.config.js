import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// dev: api на :8787 (node api/src/server.js), BSL LS на :8025
export default defineConfig({
  plugins: [react()],
  server: {
    fs: { allow: [".."] },
    proxy: {
      "/api": "http://127.0.0.1:8787",
      "/lsp": { target: "ws://127.0.0.1:8025", ws: true },
    },
  },
  build: { chunkSizeWarningLimit: 4000 },
});
