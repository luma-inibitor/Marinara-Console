#!/usr/bin/env node
// Marinara Console server: serves the built client (dist/) and proxies /api/*
// to a running Marinara Engine, stripping the `embedding` field from entry
// payloads on the way back. Those vectors are ~85% of an entries response and
// the console never renders them.
//
// The server itself is dependency-free — `node server.mjs` after `npm run build`.

import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, join, normalize, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = resolve(fileURLToPath(import.meta.url), "..");
const DIST = join(HERE, "dist");       // built console (vite)

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

// ── API proxy ─────────────────────────────────────────────────────
async function proxy(req, res, url) {
  const target = TARGET + url.pathname + url.search;
  const headers = { accept: "application/json" };
  if (req.headers["content-type"]) headers["content-type"] = req.headers["content-type"];

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
  const root = DIST;
  const rel = normalize(pathname === "/" ? "/index.html" : pathname).replace(/^(\.\.[/\\])+/, "");
  const file = join(root, rel);
  if (!file.startsWith(root)) {
    res.writeHead(403).end("Forbidden");
    return;
  }
  try {
    const info = await stat(file);
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
