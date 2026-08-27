#!/usr/bin/env node
// Marinara Console server: serves the built client and the design mockups, and
// proxies /api/* to a Marinara Engine with entry vectors stripped out.

import { createServer } from "node:http";
import { mkdir, readFile, readdir, rename, stat, unlink, writeFile } from "node:fs/promises";
import { extname, join, normalize, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createProxyMiddleware } from "http-proxy-middleware";
import { lookup } from "mrmime";
import sirv from "sirv";

const HERE = resolve(fileURLToPath(import.meta.url), "..");
// MC_DIST/MC_PUBLIC let the conformance suite aim the static roots at fixtures.
const DIST = resolve(process.env.MC_DIST ?? join(HERE, "dist"));
const PUBLIC = resolve(process.env.MC_PUBLIC ?? join(HERE, "public"));

const PORT = Number(process.env.PORT ?? 7872);
const HOST = process.env.HOST ?? "0.0.0.0";
const TARGET = (process.env.MARINARA_URL ?? "http://127.0.0.1:7860").replace(/\/+$/, "");

// ── payload slimming ──────────────────────────────────────────────
// Recursively drop `embedding` from anything that looks like an entry.
// Kept generic so it survives shape changes upstream.
function stripVectors(node) {
  if (Array.isArray(node)) return node.map(stripVectors);
  if (node && typeof node === "object") {
    const out = {};
    for (const [k, v] of Object.entries(node)) {
      if (k === "embedding") {
        out.hasEmbedding = Array.isArray(v) && v.length > 0;
        continue;
      }
      out[k] = stripVectors(v);
    }
    return out;
  }
  return node;
}

// ── automatic restore point (long-term-memory) ────────────────────
// There is no undo in the LTM store, so before the first LTM write of each
// server run the proxy pulls the package's own backup export and keeps it
// locally: one per run, taken before the write proceeds, newest 10 retained,
// atomic write. Preflight/search/previews are reads in POST clothing.
const BACKUPS = join(HERE, ".backups");
let ltmBackupDone = false;
/** @type {Promise<void>|null} */
let ltmBackupInFlight = null;

function isLtmWrite(method, pathname) {
  if (method === "GET" || method === "HEAD") return false;
  if (!pathname.startsWith("/api/long-term-memory/")) return false;
  if (/\/(preflight|search|preview|rename-preview|transfer-preview)$/.test(pathname)) return false;
  return true;
}

async function ensureLtmRestorePoint() {
  if (ltmBackupDone) return;
  ltmBackupInFlight ??= (async () => {
    const upstream = await fetch(`${TARGET}/api/long-term-memory/backup/export`, {
      headers: {
        origin: TARGET,
        ...(process.env.MARINARA_ADMIN_SECRET ? { "x-admin-secret": process.env.MARINARA_ADMIN_SECRET } : {}),
      },
    });
    if (!upstream.ok) throw new Error(`backup/export -> ${upstream.status}`);
    const bytes = Buffer.from(await upstream.arrayBuffer());
    await mkdir(BACKUPS, { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const ext = /zip/.test(upstream.headers.get("content-type") ?? "") ? "zip" : "json";
    const dest = join(BACKUPS, `ltm-backup-${stamp}.${ext}`);
    await writeFile(`${dest}.tmp`, bytes);
    await rename(`${dest}.tmp`, dest);
    ltmBackupDone = true;
    console.log(`ltm restore point: ${dest} (${bytes.length.toLocaleString()} bytes)`);
    const entries = (await readdir(BACKUPS)).filter((n) => n.startsWith("ltm-backup-")).sort();
    while (entries.length > 10) {
      const oldest = entries.shift();
      if (oldest) await unlink(join(BACKUPS, oldest)).catch(() => {});
    }
  })().finally(() => { ltmBackupInFlight = null; });
  await ltmBackupInFlight;
}

// ── console state (decision ledger etc.) ──────────────────────────
// Small named JSON documents, keyed by engine target so a laptop pointed at
// two engines keeps two ledgers. Atomic writes.
const STATE_DIR = join(HERE, ".state");
const stateFile = (name) => join(STATE_DIR, `${name}-${TARGET.replace(/[^a-z0-9]+/gi, "_")}.json`);

async function handleState(req, res, name) {
  if (!/^[a-z0-9-]{1,60}$/.test(name)) {
    res.writeHead(400, { "content-type": "application/json" });
    res.end('{"error":"bad state name"}');
    return;
  }
  if (req.method === "GET") {
    try {
      const data = await readFile(stateFile(name));
      res.writeHead(200, { "content-type": "application/json", "cache-control": "no-store" });
      res.end(data);
    } catch {
      res.writeHead(200, { "content-type": "application/json", "cache-control": "no-store" });
      res.end("{}");
    }
    return;
  }
  if (req.method === "PUT") {
    const chunks = [];
    for await (const c of req) chunks.push(c);
    const body = Buffer.concat(chunks);
    try {
      JSON.parse(body.toString()); // reject malformed state before touching disk
    } catch {
      res.writeHead(400, { "content-type": "application/json" });
      res.end('{"error":"malformed state"}');
      return;
    }
    await mkdir(STATE_DIR, { recursive: true });
    await writeFile(`${stateFile(name)}.tmp`, body);
    await rename(`${stateFile(name)}.tmp`, stateFile(name));
    res.writeHead(200, { "content-type": "application/json" });
    res.end('{"ok":true}');
    return;
  }
  res.writeHead(405).end();
}

// ── API proxy ─────────────────────────────────────────────────────
const apiProxy = createProxyMiddleware({
  target: TARGET,
  changeOrigin: true,
  selfHandleResponse: true,
  on: {
    proxyReq(proxyReq) {
      // The engine's CSRF check requires a trusted Origin; privileged routes
      // off loopback need the admin secret. The browser never needs either.
      proxyReq.setHeader("accept", "application/json");
      proxyReq.setHeader("origin", TARGET);
      if (process.env.MARINARA_ADMIN_SECRET) proxyReq.setHeader("x-admin-secret", process.env.MARINARA_ADMIN_SECRET);
      // A compressed upstream body cannot be rewritten below.
      proxyReq.removeHeader("accept-encoding");
    },
    proxyRes(proxyRes, _req, res) {
      // An upstream response always carries a status; 502 stands for one
      // that somehow did not, which is a broken engine either way.
      const status = proxyRes.statusCode ?? 502;
      const type = proxyRes.headers["content-type"] ?? "application/octet-stream";
      if (!type.includes("application/json")) {
        const len = proxyRes.headers["content-length"];
        res.writeHead(status, { "content-type": type, ...(len ? { "content-length": len } : {}) });
        proxyRes.pipe(res);
        return;
      }
      const chunks = [];
      proxyRes.on("data", (c) => chunks.push(c));
      proxyRes.on("end", () => {
        const text = Buffer.concat(chunks).toString("utf8");
        let payload;
        if (text) {
          try {
            payload = JSON.parse(text);
          } catch {
            res.writeHead(status, { "content-type": type });
            res.end(text);
            return;
          }
        } else {
          res.writeHead(status, { "content-type": type });
          res.end("");
          return;
        }
        const slimmed = JSON.stringify(stripVectors(payload));
        res.writeHead(status, {
          "content-type": "application/json; charset=utf-8",
          "content-length": Buffer.byteLength(slimmed),
          "x-lbm-original-bytes": Buffer.byteLength(text),
          "cache-control": "no-store",
        });
        res.end(slimmed);
      });
    },
    error(/** @type {NodeJS.ErrnoException} */ err, _req, res) {
      // `res` is a raw Socket when a websocket upgrade fails, and has no HTTP
      // response to write. This proxy sets no `ws`, so nothing reaches that
      // path today; closing the socket keeps it right if one ever does.
      if (!("writeHead" in res)) {
        res.destroy();
        return;
      }
      if (res.headersSent) {
        res.end();
        return;
      }
      res.writeHead(502, { "content-type": "application/json" });
      res.end(JSON.stringify({ error: `Cannot reach engine at ${TARGET}`, detail: String(err?.code ?? err?.message ?? err) }));
    },
  },
});

// ── static ────────────────────────────────────────────────────────
// mrmime carries no `.ico`, and gives the text types no charset.
const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".ico": "image/x-icon",
};

// Vite writes a content hash of at least eight characters into every name it
// emits under assets/, so a changed file always arrives under a new name.
const HASHED_ASSET = /^\/assets\/.+-[\w-]{8,}\.\w+$/;

function staticHeaders(res, pathname) {
  const ext = extname(pathname) || ".html";
  res.setHeader("content-type", MIME[ext] ?? lookup(ext) ?? "application/octet-stream");
  res.setHeader("cache-control", HASHED_ASSET.test(pathname) ? "public,max-age=31536000,immutable" : "no-store");
}

function notFound(_req, res) {
  res.writeHead(404, { "content-type": "text/plain" });
  res.end("Not found");
}

// `dev` re-reads the directory per request. The default reads it once at
// startup, so a build during a run 404s every file it emits.
// Gotcha: sirv's default `extensions` resolves /index to index.html as well as
// finding a directory index, so the index is named below instead.
// `brotli`/`gz` send the sibling scripts/precompress.mjs wrote, and fall back
// to the file itself where there is none. sirv sets Vary on every static reply
// once either is on, including the replies with no sibling to choose from.
const sirvOptions = {
  dev: true, etag: true, extensions: [], brotli: true, gzip: true,
  setHeaders: staticHeaders, onNoMatch: notFound,
};
const distFiles = sirv(DIST, sirvOptions);
const publicFiles = sirv(PUBLIC, sirvOptions);

async function isDirectory(root, pathname) {
  const abs = normalize(join(root, pathname));
  if (!abs.startsWith(root)) return false;
  return stat(abs).then((info) => info.isDirectory(), () => false);
}

async function serveStatic(req, res, url) {
  // The built console at /, the design mockups at /mockups/. The mockup
  // directory mirrors its URL underneath public/, so nothing is stripped from
  // the path — only the root changes.
  const mockups = url.pathname === "/mockups" || url.pathname.startsWith("/mockups/");
  if (!url.pathname.endsWith("/") && (await isDirectory(mockups ? PUBLIC : DIST, url.pathname))) {
    // Relative links on the page only resolve correctly from the slashed form.
    res.writeHead(302, { location: `${url.pathname}/` }).end();
    return;
  }
  // Gotcha: sirv reads `content-encoding` off the last three characters of the
  // name and sets it even when the client offered no encoding, and even when
  // its own brotli and gzip options are off. So a `.tar.gz` download reaches
  // the browser unpacked under its packed name. Nothing under dist/ or public/
  // is reachable only under a `.br` or `.gz` name.
  if (/\.(br|gz)$/.test(url.pathname)) return notFound(req, res);
  // Gotcha: sirv strips a trailing slash before it looks, so /index.html/ would
  // otherwise serve the file.
  const pathname = url.pathname.endsWith("/") ? `${url.pathname}index.html` : url.pathname;
  // sirv percent-decodes what it reads from `req.url`; escaping the percent
  // signs makes that decode a no-op, so the path stays byte-exact.
  req.url = pathname.replaceAll("%", "%25") + url.search;
  (mockups ? publicFiles : distFiles)(req, res);
}

createServer(async (req, res) => {
  try {
    const url = new URL(req.url ?? "/", "http://localhost");
    if (url.pathname === "/__config") {
      const cfg = JSON.stringify({ target: TARGET });
      res.writeHead(200, { "content-type": "application/json", "content-length": cfg.length });
      res.end(cfg);
      return;
    }
    const stateMatch = /^\/console\/state\/([a-z0-9-]+)$/.exec(url.pathname);
    if (stateMatch) return await handleState(req, res, stateMatch[1]);
    if (url.pathname.startsWith("/api/")) {
      if (isLtmWrite(req.method, url.pathname)) {
        try {
          // Gotcha: `on.proxyReq` cannot await — the request is on the wire by then.
          await ensureLtmRestorePoint();
        } catch (err) {
          // Fail open: a hiccuping export route must not block every write.
          console.error(`LTM RESTORE POINT FAILED before ${req.method} ${url.pathname}: ${err.message}`);
          res.setHeader("x-ltm-restore-point", "failed");
        }
      }
      return await apiProxy(req, res);
    }
    await serveStatic(req, res, url);
  } catch (err) {
    if (!res.headersSent) res.writeHead(500, { "content-type": "application/json" });
    res.end(JSON.stringify({ error: String(err?.message ?? err) }));
  }
}).listen(PORT, HOST, () => {
  console.log(`marinara-console  →  http://${HOST}:${PORT}`);
  console.log(`engine           →  ${TARGET}`);
});
