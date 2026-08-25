import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

const proxyTarget = process.env.MC_PROXY_TARGET ?? "http://127.0.0.1:7872";
const devPort = Number(process.env.MC_DEV_PORT ?? 5173);

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // public/ is the legacy no-build app, NOT vite's static dir — don't copy it into dist
  publicDir: false,
  build: { outDir: "dist" },
  server: {
    port: devPort,
    // dev goes through server.mjs so the embedding strip applies in dev too
    proxy: {
      "/api": proxyTarget,
      "/__config": proxyTarget,
    },
  },
});
