#!/usr/bin/env node
// Snapshot the rendered DOM as a class-and-tag skeleton, so a refactor that
// claims "renders identically" can be checked instead of asserted.
//
//   node design/domsnap.mjs before        # capture
//   node design/domsnap.mjs after --diff  # capture and compare
//
// Deliberately ignores text content and attribute values: this answers "did
// the element tree and its styling hooks change", which is the question a
// component extraction actually raises.
import { chromium } from "playwright-core";
const DEV_URL = (process.env.MC_DEV_URL ?? "http://127.0.0.1:5173") + "/";
import fs from "node:fs";

const tag = process.argv[2] ?? "snap";
const diff = process.argv.includes("--diff");
// The book audit needs a real book id — it is the densest screen in the
// console and the one most likely to break silently.
const BOOK = process.env.MC_BOOK ?? "JZzGg_2NjFx1hFP_G4Yeq";
const PAGES = [
  ["sources", "#/memory/sources"], ["review", "#/memory/review"],
  ["vault", "#/memory/vault"], ["lore", "#/lorebooks"],
  ["book", `#/lorebooks/${BOOK}`],
];
const VPS = [{ n: "phone", w: 486, h: 1085 }, { n: "desktop", w: 1280, h: 800 }];

const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH });
const out = {};
for (const [name, hash] of PAGES) for (const vp of VPS) {
  const p = await browser.newPage({ viewport: { width: vp.w, height: vp.h } });
  await p.goto(DEV_URL + hash, { waitUntil: "networkidle", timeout: 60000 });
  await p.waitForTimeout(1400);
  out[`${name}/${vp.n}`] = await p.evaluate(() =>
    [...document.querySelectorAll("#app *")].map((el) => {
      const cls = (typeof el.className === "string" ? el.className : "").trim().split(/\s+/).sort().join(".");
      return el.tagName.toLowerCase() + (cls ? "." + cls : "");
    }));
  await p.close();
}
await browser.close();
fs.writeFileSync(`/tmp/domsnap-${tag}.json`, JSON.stringify(out, null, 1));

if (!diff) { console.log(`captured ${tag}`); process.exit(0); }
const base = JSON.parse(fs.readFileSync("/tmp/domsnap-before.json", "utf8"));
let bad = 0;
for (const key of Object.keys(base)) {
  const a = base[key], b = out[key] ?? [];
  const count = (list) => list.reduce((m, x) => m.set(x, (m.get(x) ?? 0) + 1), new Map());
  const ca = count(a), cb = count(b), keys = new Set([...ca.keys(), ...cb.keys()]);
  const rows = [...keys].filter((k) => (ca.get(k) ?? 0) !== (cb.get(k) ?? 0))
    .map((k) => `      ${(ca.get(k) ?? 0)} -> ${(cb.get(k) ?? 0)}  ${k}`);
  if (rows.length) { bad++; console.log(`  ${key}: ${a.length} -> ${b.length} elements`); console.log(rows.join("\n")); }
  else console.log(`  ${key}: identical (${a.length} elements)`);
}
console.log(bad === 0 ? "\nDOM unchanged" : `\n${bad} page/viewport pairs differ`);
