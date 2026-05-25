import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/ai": "http://127.0.0.1:8000",
      "/app": "http://127.0.0.1:8000",
      "/budget": "http://127.0.0.1:8000",
      "/dashboard": "http://127.0.0.1:8000",
      "/export": "http://127.0.0.1:8000",
      "/receipt": "http://127.0.0.1:8000",
      "/user": "http://127.0.0.1:8000"
    }
  },
  build: {
    outDir: "dist",
    sourcemap: true
  }
});
