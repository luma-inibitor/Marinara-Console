#!/usr/bin/env node
// Copy check: every user-visible string in a rendered surface must trace to
// the vendored product catalog (ltm-en.json) or be a registered coinage in
// OURS. Coining silently is the defect this catches — it has shipped three
// times in one week, each time with the catalog already holding the word.
//
//   node design/copycheck.mjs public/mockups/sources-v1.html
//
// Specimen books carry a meta layer (captions, intros, legends) that is prose
// about the design, not product copy; those are skipped by class.

import { readFileSync } from "node:fs";

const META_CLASSES = /\b(caption|intro|legend|spec-label|subtitle|revband|okband|clab|mk|secno)\b/;
const catalog = JSON.parse(readFileSync(new URL("../src/tools/memory/ltm-en.json", import.meta.url), "utf8"));
const CATALOG = Object.values(catalog).filter((v) => typeof v === "string").map((v) => v.toLowerCase());
const OURS = readFileSync(new URL("../src/tools/memory/strings.ts", import.meta.url), "utf8")
  .match(/"[^"]+"/g).map((s) => s.slice(1, -1).toLowerCase());

const html = readFileSync(process.argv[2], "utf8");

// crude but sufficient: strip meta-layer blocks, then take text inside leaf tags
const stripped = html.replace(/<(figcaption|ul|p|h1|h2)\b[^>]*>[\s\S]*?<\/\1>/g, (m) =>
  META_CLASSES.test(m) ? "" : m);

const strings = new Set();
for (const m of stripped.matchAll(/<(button|span|div|b|h3|h4|summary)\b([^>]*)>([^<>]{2,90})</g)) {
  if (META_CLASSES.test(m[2])) continue;
  const t = m[3].replace(/\s+/g, " ").trim();
  if (!t || /^[\d\s·—…✓✗+−(){}[\]%\/.,-]+$/.test(t)) continue;
  strings.add(t);
}

// Exact matching only. Substring matching was the first version of this tool
// and it passed 89 of 89 strings, including three the owner had already
// flagged as coined — a check that never fails is not a check.
const norm = (s) => s.toLowerCase()
  .replace(/\s*\(\d+\)\s*$/, "")   // trailing counts: "Select all (8)"
  .replace(/\s+\d+$/, "")           // trailing counts: "Select all 8"
  .replace(/[.:\u2026]$/, "")
  .replace(/\s+/g, " ").trim();
const CAT = new Set(CATALOG.map((c) => norm(c.replace(/\{\{\w+\}\}/g, "").replace(/\s+/g, " "))));
const OUR = new Set(OURS.map(norm));
const covered = (s) => CAT.has(norm(s)) || OUR.has(norm(s));

const uncovered = [...strings].filter((s) => !covered(s)).sort();
console.log(`${strings.size} user-visible strings · ${strings.size - uncovered.length} trace to the catalog or OURS\n`);
if (uncovered.length) {
  console.log("NOT TRACED — each must be found in the catalog, or registered in OURS with a reason:");
  for (const s of uncovered) console.log("  " + s);
}
process.exitCode = uncovered.length ? 1 : 0;
