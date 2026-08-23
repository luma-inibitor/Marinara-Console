#!/usr/bin/env node
// Marinara Console server: serves the built client (dist/) and proxies /api/*
// to a running Marinara Engine, stripping the `embedding` field from entry
// payloads on the way back. Those vectors are ~85% of an entries response and
// the console never renders them.
//
// The server itself is dependency-free — `node server.mjs` after `npm run build`.

import { createServer } from "node:http";
import { mkdir, readFile, readdir, rename, stat, unlink, writeFile } from "node:fs/promises";
import { extname, join, normalize, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = resolve(fileURLToPath(import.meta.url), "..");
const DIST = join(HERE, "dist");       // built console (vite)
const PUBLIC = join(HERE, "public");   // design mockups, served at /mockups/

const PORT = Number(process.env.PORT ?? 7872);
const HOST = process.env.HOST ?? "0.0.0.0";
const TARGET = (process.env.MARINARA_URL ?? "http://127.0.0.1:7860").replace(/\/+$/, "");

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".woff2": "font/woff2",
};

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
    while (entries.length > 10) await unlink(join(BACKUPS, entries.shift())).catch(() => {});
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
async function proxy(req, res, url) {
  if (isLtmWrite(req.method, url.pathname)) {
    try {
      await ensureLtmRestorePoint();
    } catch (err) {
      // Fail open, loudly: blocking every write on a hiccuping export route
      // would be worse, but the miss must be visible.
      console.error(`LTM RESTORE POINT FAILED before ${req.method} ${url.pathname}: ${err.message}`);
      res.setHeader("x-ltm-restore-point", "failed");
    }
  }
  const target = TARGET + url.pathname + url.search;
  // The engine's CSRF check requires a trusted Origin; privileged routes off
  // loopback need the admin secret. The browser never needs to know either.
  const headers = { accept: "application/json", origin: TARGET };
  if (req.headers["content-type"]) headers["content-type"] = req.headers["content-type"];
  if (process.env.MARINARA_ADMIN_SECRET) headers["x-admin-secret"] = process.env.MARINARA_ADMIN_SECRET;

  let body;
  if (req.method !== "GET" && req.method !== "HEAD") {
    const chunks = [];
    for await (const c of req) chunks.push(c);
    body = Buffer.concat(chunks);
  }

  let upstream;
  try {
    upstream = await fetch(target, { method: req.method, headers, body });
  } catch (err) {
    res.writeHead(502, { "content-type": "application/json" });
    res.end(JSON.stringify({ error: `Cannot reach engine at ${TARGET}`, detail: String(err?.cause?.code ?? err?.message ?? err) }));
    return;
  }

  const type = upstream.headers.get("content-type") ?? "application/octet-stream";

  // Only JSON gets rewritten; exports and images stream through untouched.
  if (!type.includes("application/json")) {
    const buf = Buffer.from(await upstream.arrayBuffer());
    res.writeHead(upstream.status, { "content-type": type, "content-length": buf.length });
    res.end(buf);
    return;
  }

  const text = await upstream.text();
  if (!text) {
    res.writeHead(upstream.status, { "content-type": type });
    res.end("");
    return;
  }

  let payload;
  try {
    payload = JSON.parse(text);
  } catch {
    res.writeHead(upstream.status, { "content-type": type });
    res.end(text);
    return;
  }

  const slimmed = JSON.stringify(stripVectors(payload));
  res.writeHead(upstream.status, {
    "content-type": "application/json; charset=utf-8",
    "content-length": Buffer.byteLength(slimmed),
    "x-lbm-original-bytes": Buffer.byteLength(text),
    "cache-control": "no-store",
  });
  res.end(slimmed);
}

// ── static ────────────────────────────────────────────────────────
async function serveStatic(res, pathname) {
  // The built console at /, the design mockups at /mockups/. The mockup
  // directory mirrors its URL underneath public/, so nothing is stripped from
  // the path — only the root changes.
  const root = pathname === "/mockups" || pathname.startsWith("/mockups/") ? PUBLIC : DIST;
  if (pathname === "/mockups") {
    // Same reason as any other directory below: relative links on the page
    // only resolve correctly from the slashed form.
    res.writeHead(302, { location: "/mockups/" }).end();
    return;
  }
  // Any directory serves its index.html, not just the root. Only "/" was
  // special-cased before, so /mockups/ 404'd while /mockups/index.html served
  // fine — a front door nobody could open.
  const rel = normalize(pathname.endsWith("/") ? `${pathname}index.html` : pathname)
    .replace(/^(\.\.[/\\])+/, "");
  const file = join(root, rel);
  if (!file.startsWith(root)) {
    res.writeHead(403).end("Forbidden");
    return;
  }
  try {
    const info = await stat(file);
    // A directory reached without a trailing slash redirects to one, so
    // /mockups/detail-v5 gets you where /mockups/detail-v5/ does. Relative links on
    // the page only resolve correctly from the slashed form, which is why the
    // redirect is the fix rather than serving the index from both.
    if (info.isDirectory()) {
      res.writeHead(302, { location: `${pathname}/` }).end();
      return;
    }
    if (!info.isFile()) throw new Error("not a file");
    const buf = await readFile(file);
    res.writeHead(200, {
      "content-type": MIME[extname(file)] ?? "application/octet-stream",
      "content-length": buf.length,
      "cache-control": "no-store",
    });
    res.end(buf);
  } catch {
    res.writeHead(404, { "content-type": "text/plain" }).end("Not found");
  }
}

createServer(async (req, res) => {
  const url = new URL(req.url, "http://localhost");
  try {
    if (url.pathname === "/__config") {
      const cfg = JSON.stringify({ target: TARGET });
      res.writeHead(200, { "content-type": "application/json", "content-length": cfg.length });
      res.end(cfg);
      return;
    }
    const stateMatch = /^\/console\/state\/([a-z0-9-]+)$/.exec(url.pathname);
    if (stateMatch) return await handleState(req, res, stateMatch[1]);
    if (url.pathname.startsWith("/api/")) return await proxy(req, res, url);
    await serveStatic(res, url.pathname);
  } catch (err) {
    if (!res.headersSent) res.writeHead(500, { "content-type": "application/json" });
    res.end(JSON.stringify({ error: String(err?.message ?? err) }));
  }
}).listen(PORT, HOST, () => {
  console.log(`marinara-console  →  http://${HOST}:${PORT}`);
  console.log(`engine           →  ${TARGET}`);
});
