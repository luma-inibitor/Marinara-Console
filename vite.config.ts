import { defineConfig } from "vite";
import preact from "@preact/preset-vite";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [preact(), tailwindcss()],
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
