import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  base: "./",
  server: {
    port: 5173,
    proxy: { "/api": "http://127.0.0.1:8010", "/fotos": "http://127.0.0.1:8010" },
  },
  build: {
    outDir: "../app/static",
    emptyOutDir: false,
    assetsDir: "assets",
  },
});
