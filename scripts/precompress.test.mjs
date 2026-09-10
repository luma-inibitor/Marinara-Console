// What precompress.mjs must get right: write a sibling only where it pays, and
// never leave one behind that answers for a file that is gone.
import { afterEach, beforeEach, expect, it } from "vitest";
import { brotliDecompressSync, gunzipSync } from "node:zlib";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { precompress } from "./precompress.mjs";

let dist;
beforeEach(() => (dist = mkdtempSync(join(tmpdir(), "precompress-"))));
afterEach(() => rmSync(dist, { recursive: true, force: true }));

const write = (name, bytes) => {
  mkdirSync(join(dist, name, ".."), { recursive: true });
  writeFileSync(join(dist, name), bytes);
  return join(dist, name);
};
// Repetitive text, so brotli and gzip both beat it by a wide margin.
const compressible = (n) => Buffer.from("a,b,c;".repeat(n));

it("writes both siblings beside a file worth compressing", () => {
  const abs = write("assets/app.js", compressible(500));
  precompress(dist);
  expect(existsSync(`${abs}.br`)).toBe(true);
  expect(existsSync(`${abs}.gz`)).toBe(true);
});

it("writes bytes that decode back to the file exactly", () => {
  const body = compressible(500);
  const abs = write("assets/app.js", body);
  precompress(dist);
  expect(brotliDecompressSync(readFileSync(`${abs}.br`))).toEqual(body);
  expect(gunzipSync(readFileSync(`${abs}.gz`))).toEqual(body);
});

it("leaves a type that is already compressed alone", () => {
  const abs = write("assets/font.woff2", compressible(500));
  precompress(dist);
  expect(existsSync(`${abs}.br`)).toBe(false);
});

it("leaves a file too small for compression to buy a round trip alone", () => {
  const abs = write("index.html", compressible(10));
  precompress(dist);
  expect(existsSync(`${abs}.br`)).toBe(false);
});

// Incompressible bytes of a compressible type: brotli and gzip both come out
// bigger, and sirv would send the bigger one in preference to the file.
it("writes no sibling where the encoding comes out bigger than the file", () => {
  // xorshift rather than a counter: `i % 251` is periodic, and brotli finds it.
  const noise = Buffer.alloc(4096);
  let x = 0x9e3779b9;
  for (let i = 0; i < noise.length; i++) {
    x ^= x << 13;
    x >>>= 0;
    x ^= x >>> 17;
    x ^= x << 5;
    x >>>= 0;
    noise[i] = x & 0xff;
  }
  const abs = write("assets/noise.json", noise);
  const [row] = precompress(dist);
  expect(row.wrote).toEqual([]);
  expect(existsSync(`${abs}.br`)).toBe(false);
  expect(existsSync(`${abs}.gz`)).toBe(false);
});

// The one that matters on a hand-edited tree: `vite build` empties dist/, but a
// run over a tree where a file was removed by hand must not leave its sibling
// answering for it.
it("deletes a sibling whose file has gone", () => {
  const orphan = join(dist, "assets", "old.js.br");
  mkdirSync(join(dist, "assets"), { recursive: true });
  writeFileSync(orphan, "stale");
  precompress(dist);
  expect(existsSync(orphan)).toBe(false);
});

it("rewrites a stale sibling from the file beside it", () => {
  const abs = write("assets/app.js", compressible(500));
  writeFileSync(`${abs}.br`, "stale");
  precompress(dist);
  expect(brotliDecompressSync(readFileSync(`${abs}.br`))).toEqual(compressible(500));
});

// The sweep reads any `.br`/`.gz` as a sibling unless it checks what the name
// strips to, and `data.tar` is nobody's source file.
it("leaves a download whose name merely ends in .gz alone", () => {
  const abs = write("downloads/data.tar.gz", Buffer.from("a genuine download"));
  precompress(dist);
  expect(existsSync(abs)).toBe(true);
});

it("is unchanged by a second run", () => {
  write("assets/app.js", compressible(500));
  write("assets/font.woff2", compressible(500));
  const first = precompress(dist);
  expect(precompress(dist)).toEqual(first);
});
