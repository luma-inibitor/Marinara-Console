#!/usr/bin/env node
// Count the legacy disable comments under src/ per eslint rule and hold each
// count to design/ratchet-baseline.json.
//
//   node scripts/ratchet.mjs
//   node scripts/ratchet.mjs --adopt   # record today's counts as the baseline
//
// A legacy file carries `/* eslint-disable <rule>, <rule> -- legacy */` at its
// top, one comment per file, and nothing in eslint.config.js names the file.
// So retiring a file is an edit to that file, and two pull requests that each
// retire one never touch the same line. This check is the ratchet over that:
// a count that rises fails, and a count that falls fails until the baseline
// says the new number, so the record never carries slack. A comment for a
// rule the file no longer breaks is eslint's to catch, through
// reportUnusedDisableDirectives.
//
// Exit codes: 0 every count matches · 1 a count moved · 2 the baseline is
// unreadable, which must never read as a pass.
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SRC = join(ROOT, "src");
const BASELINE = join(ROOT, "design", "ratchet-baseline.json");
const ADOPT = process.argv.includes("--adopt");

// The comment form the config asks for. `-- legacy` is what makes it count.
const LEGACY = /\/\*\s*eslint-disable\s+([^*]*?)\s+--\s+legacy\s*\*\//g;

function* files(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) yield* files(path);
    else if (/\.tsx?$/.test(entry.name)) yield path;
  }
}

/** @returns {Record<string, string[]>} rule to the files that disable it */
function count() {
  /** @type {Record<string, string[]>} */
  const byRule = {};
  for (const path of files(SRC)) {
    for (const [, list] of readFileSync(path, "utf8").matchAll(LEGACY)) {
      for (const rule of list
        .split(",")
        .map((r) => r.trim())
        .filter(Boolean)) {
        (byRule[rule] ??= []).push(relative(ROOT, path));
      }
    }
  }
  return byRule;
}

/** @returns {Record<string, number>} */
function loadBaseline() {
  let parsed;
  try {
    parsed = JSON.parse(readFileSync(BASELINE, "utf8"));
  } catch (e) {
    console.log("\nBASELINE INTEGRITY FAILURE — the check itself is compromised:");
    console.log(`  ${relative(ROOT, BASELINE)} is unreadable: ${e.message}`);
    process.exit(2);
  }
  const bad = !parsed || typeof parsed !== "object" || Array.isArray(parsed);
  if (bad || Object.values(parsed).some((n) => !Number.isInteger(n) || n < 0)) {
    console.log("\nBASELINE INTEGRITY FAILURE — the check itself is compromised:");
    console.log(`  ${relative(ROOT, BASELINE)} must map each rule to a whole number`);
    process.exit(2);
  }
  return parsed;
}

const today = count();
const counts = Object.fromEntries(
  Object.keys(today)
    .sort()
    .map((rule) => [rule, today[rule].length]),
);

if (ADOPT) {
  writeFileSync(BASELINE, JSON.stringify(counts, null, 2) + "\n");
  console.log(`\nbaseline adopted — ${relative(ROOT, BASELINE)} now records today's counts`);
  for (const [rule, n] of Object.entries(counts)) console.log(`  ${n.toString().padStart(4)}  ${rule}`);
  process.exit(0);
}

const baseline = loadBaseline();
const rules = [...new Set([...Object.keys(baseline), ...Object.keys(counts)])].sort();
let moved = 0;
console.log("");
for (const rule of rules) {
  const was = baseline[rule] ?? 0;
  const now = counts[rule] ?? 0;
  if (now > was) {
    moved++;
    console.log(`ROSE  ${rule}: ${was} -> ${now}. A file may not join the legacy list.`);
    for (const file of today[rule]) console.log(`        ${file}`);
  } else if (now < was) {
    moved++;
    console.log(`FELL  ${rule}: ${was} -> ${now}. Lower it in ${relative(ROOT, BASELINE)}, or run --adopt.`);
  } else {
    console.log(`ok    ${rule}: ${now}`);
  }
}
console.log(moved ? `\n${moved} count(s) moved` : "\nevery count matches the baseline");
process.exit(moved ? 1 : 0);
