#!/usr/bin/env node
// Report the computed type face of every element carrying a type utility, so a
// class that claims a face can be checked against the face it actually gets.
//
//   node design/faceprobe.mjs before
//   node design/faceprobe.mjs after --diff
//
// domsnap answers "did the element tree change" and deadcss answers "is this
// rule matched by anything". Neither catches the failure this exists for: a
// utility that matches plenty of elements and loses every one of them to a
// component rule, so the markup asserts a face the page never renders.
import { chromium } from "playwright-core";
import fs from "node:fs";

const DEV_URL = (process.env.MC_DEV_URL ?? "http://127.0.0.1:5173") + "/";
const tag = process.argv[2] ?? "snap";
const diff = process.argv.includes("--diff");
const BOOK = process.env.MC_BOOK ?? "JZzGg_2NjFx1hFP_G4Yeq";
const SEL = ".t-prose, .t-label, .t-data, .t-num";
const PAGES = [
  ["sources", "#/memory/sources"], ["review", "#/memory/review"],
  ["vault", "#/memory/vault"], ["lore", "#/lorebooks"],
  ["book", `#/lorebooks/${BOOK}`], ["presets", "#/presets"],
];

const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH });
const out = {};
for (const [name, hash] of PAGES) {
  const p = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  await p.goto(DEV_URL + hash, { waitUntil: "networkidle", timeout: 60000 });
  await p.waitForTimeout(1200);
  out[name] = await p.evaluate((sel) => [...document.querySelectorAll(sel)].map((el) => {
    const s = getComputedStyle(el);
    const cls = (typeof el.className === "string" ? el.className : "").trim().split(/\s+/).sort().join(".");
    return [el.tagName.toLowerCase() + "." + cls, s.fontFamily.split(",")[0], s.fontSize,
            s.fontWeight, s.letterSpacing, s.textTransform, s.fontVariantNumeric].join(" | ");
  }), SEL);
  await p.close();
}
await browser.close();
fs.writeFileSync(`/tmp/faceprobe-${tag}.json`, JSON.stringify(out, null, 1));
if (!diff) { console.log(`captured ${tag}`); process.exit(0); }

const base = JSON.parse(fs.readFileSync("/tmp/faceprobe-before.json", "utf8"));
const count = (o) => { const m = new Map(); for (const k in o) for (const r of o[k]) m.set(`${k} | ${r}`, (m.get(`${k} | ${r}`) ?? 0) + 1); return m; };
const a = count(base), b = count(out);
let bad = 0;
for (const k of new Set([...a.keys(), ...b.keys()])) {
  const x = a.get(k) ?? 0, y = b.get(k) ?? 0;
  if (x !== y) { bad++; console.log(`  ${x} -> ${y}  ${k}`); }
}
console.log(bad === 0 ? "\nfaces unchanged" : `\n${bad} rows differ`);
