import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

const bundlerWarnings: string[] = [];

// A throw inside onwarn is swallowed by rolldown: the build still exits 0.
// The warnings have to be collected there and raised after the bundle closes.
function fatalBundlerWarnings(): Plugin {
  return {
    name: "mc:fatal-bundler-warnings",
    closeBundle() {
      if (bundlerWarnings.length > 0) {
        this.error(`bundler warnings are fatal:\n${bundlerWarnings.join("\n")}`);
      }
    },
  };
}

const proxyTarget = process.env.MC_PROXY_TARGET ?? "http://127.0.0.1:7872";
const devPort = Number(process.env.MC_DEV_PORT ?? 5173);

export default defineConfig({
  plugins: [react(), tailwindcss(), fatalBundlerWarnings()],
  // public/ is the legacy no-build app, NOT vite's static dir — don't copy it into dist
  publicDir: false,
  build: {
    outDir: "dist",
    // 700 clears today's 684 kB bundle. The reporter plugin's chunk-size line
    // arrives at onwarn with no warning code, so a lower limit fails the build.
    chunkSizeWarningLimit: 700,
    rolldownOptions: {
      onwarn(warning) {
        bundlerWarnings.push(`${warning.plugin ?? warning.code ?? "warning"}: ${warning.message}`);
      },
    },
  },
  server: {
    port: devPort,
    // dev goes through server.mjs so the embedding strip applies in dev too
    proxy: {
      "/api": proxyTarget,
      "/__config": proxyTarget,
      // The console's own state (the review queue's decision ledger) is served
      // by server.mjs, not the engine, so it is not under /api and needs its
      // own entry. Without it every decision fails to persist in dev and the
      // queue shows "Failed" — while the same build served from server.mjs
      // works, which is what made this hard to see.
      "/console": proxyTarget,
    },
  },
});
