import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // public/ is the legacy no-build app, NOT vite's static dir — don't copy it into dist
  publicDir: false,
  build: { outDir: "dist" },
  server: {
    // dev goes through server.mjs so the embedding strip applies in dev too
    proxy: {
      "/api": "http://127.0.0.1:7872",
      "/__config": "http://127.0.0.1:7872",
    },
  },
});
