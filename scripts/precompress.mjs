#!/usr/bin/env node
// Writes a .br and a .gz beside every compressible file in dist/, so sirv can
// serve the compressed bytes instead of compressing per request.
//
//   node scripts/precompress.mjs
//   node scripts/precompress.mjs path/to/other/dist
//
// `npm run build` runs this, and `vite build` empties dist/ first, so a
// compressed sibling cannot outlive the file it was made from.
//
// public/ is deliberately left alone. vite.config.ts sets `publicDir: false`,
// so public/ is a source tree under version control rather than part of the
// build, and generated binaries do not belong in it.
//
// Exit codes: 0 wrote the siblings · 2 the script could not read dist/, which
// must never read as a pass.
import { readdirSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { dirname, extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { brotliCompressSync, constants, gzipSync } from "node:zlib";

const DEFAULT_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DIST = process.argv[2] ? resolve(process.cwd(), process.argv[2]) : join(DEFAULT_ROOT, "dist");

// Measured on this tree: .woff2 is already brotli inside, and recompressing the
// seventeen font files moves each between -0.1% and +0.2%. An allowlist keeps
// the near-ties out rather than relying on the smaller-than-the-original test
// below to catch every one of them.
const COMPRESSIBLE = new Set([
  ".css", ".html", ".js", ".json", ".map", ".mjs", ".svg", ".txt", ".webmanifest", ".xml",
]);

// Below about one MTU the transfer is a single packet either way, so a smaller
// body buys nothing and each sibling costs sirv a stat on every request.
const FLOOR = 1024;

function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const abs = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(abs));
    else if (entry.isFile()) out.push(abs);
  }
  return out;
}

/**
 * Compresses `dist` in place and returns one row per source file considered.
 * `wrote` names the encodings that ended up on disk; a row with none of them
 * says why in `skipped`.
 */
export function precompress(dist) {
  const all = walk(dist);
  const sources = all.filter((f) => !f.endsWith(".br") && !f.endsWith(".gz"));

  // A sibling whose source has gone answers a request for a file that is no
  // longer there, so it goes first and unconditionally.
  const live = new Set(sources);
  for (const f of all) {
    if ((f.endsWith(".br") || f.endsWith(".gz")) && !live.has(f.slice(0, -3))) unlinkSync(f);
  }

  const rows = [];
  for (const file of sources) {
    const bytes = readFileSync(file);
    const drop = (skipped) => {
      for (const ext of [".br", ".gz"]) {
        try { unlinkSync(file + ext); } catch { /* nothing to drop */ }
      }
      rows.push({ file, size: bytes.length, wrote: [], skipped });
    };

    if (!COMPRESSIBLE.has(extname(file))) { drop("not a compressible type"); continue; }
    if (bytes.length < FLOOR) { drop(`under ${FLOOR} bytes`); continue; }

    const encoded = {
      ".br": brotliCompressSync(bytes, {
        params: {
          [constants.BROTLI_PARAM_QUALITY]: 11,
          [constants.BROTLI_PARAM_SIZE_HINT]: bytes.length,
        },
      }),
      ".gz": gzipSync(bytes, { level: 9 }),
    };

    // Serving a sibling that is bigger than the file spends bandwidth to save
    // none, and sirv prefers the sibling whenever it exists.
    const wrote = [];
    for (const [ext, out] of Object.entries(encoded)) {
      if (out.length < bytes.length) {
        writeFileSync(file + ext, out);
        wrote.push({ ext, size: out.length });
      } else {
        try { unlinkSync(file + ext); } catch { /* nothing to drop */ }
      }
    }
    rows.push({ file, size: bytes.length, wrote, skipped: wrote.length ? null : "no encoding was smaller" });
  }
  return rows;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  let rows;
  try {
    rows = precompress(DIST);
  } catch (e) {
    console.error(`INTEGRITY FAILURE — ${DIST} is unreadable: ${e.message}`);
    process.exit(2);
  }

  const kb = (n) => `${(n / 1024).toFixed(1)} kB`;
  let before = 0;
  let after = 0;
  for (const row of rows.filter((r) => r.wrote.length)) {
    const br = row.wrote.find((w) => w.ext === ".br");
    before += row.size;
    after += br ? br.size : row.size;
    const parts = row.wrote.map((w) => `${w.ext.slice(1)} ${kb(w.size)}`).join(", ");
    console.log(`  ${row.file.slice(DIST.length + 1)}  ${kb(row.size)} → ${parts}`);
  }
  const saved = before ? ((1 - after / before) * 100).toFixed(1) : "0.0";
  console.log(`\n${rows.filter((r) => r.wrote.length).length} of ${rows.length} files compressed: ` +
    `${kb(before)} → ${kb(after)} brotli, ${saved}% smaller`);
}
