#!/usr/bin/env node
// Structural check on src/copy/*.json: entry shape, coinage notes, two keys
// holding one string, a coinage the product already has a word for, and a
// `despite` that names no live conflict.
//
//   node scripts/copycatalog.mjs

import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const COPY_DIR = join(ROOT, "src", "copy");
const PREFIX = "ui.longTermMemory.";
// Two clauses of prose. Below this every note read "the catalog has no word".
const MIN_NOTE = 40;
const SENT = "{}";
const TEXT_FIELDS = ["text", "one", "other"];

// ── normalization ─────────────────────────────────────────────────────────
// Placeholders collapse to one sentinel, so "{{count}} notes" and "{{n}} notes"
// are the same string and neither one matches the bare word.
const norm = (s) =>
  String(s)
    .toLowerCase()
    .replace(/\{\{\s*\w+\s*\}\}/g, SENT)
    .replace(/\s*\(\d+\)\s*$/, "")
    .replace(/\s*\(\{\}\)\s*$/, "")
    .replace(/\s+\d+$/, "")
    .replace(/[.:…]$/, "")
    .replace(/\s+/g, " ")
    .replace(/\{\}(?: ?\{\})+/g, SENT)
    .trim();

// ── tables ────────────────────────────────────────────────────────────────

const product = JSON.parse(readFileSync(join(COPY_DIR, "vendor", "ltm-en.json"), "utf8"));
const has = (key) => typeof product[PREFIX + key] === "string";

const byText = new Map();
for (const [key, value] of Object.entries(product)) {
  if (typeof value !== "string") continue;
  const n = norm(value);
  if (n && !byText.has(n)) byText.set(n, key.slice(PREFIX.length));
}

const entries = [];
for (const file of readdirSync(COPY_DIR).filter((f) => f.endsWith(".json")).sort()) {
  const data = JSON.parse(readFileSync(join(COPY_DIR, file), "utf8"));
  for (const [key, entry] of Object.entries(data)) {
    if (key.startsWith("_")) continue;
    entries.push({ file: `src/copy/${file}`, key, entry });
  }
}

// ── checks ────────────────────────────────────────────────────────────────

const problems = [];
const seen = new Map();
let coined = 0;

for (const { file, key, entry } of entries) {
  const fail = (message) => problems.push(`${file}: "${key}" ${message}`);

  if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
    fail("is not an entry object ({use} or {text,note} or {one,other,note})");
    continue;
  }

  const texts = TEXT_FIELDS.filter((f) => typeof entry[f] === "string").map((f) => entry[f]);
  const isMirror = typeof entry.use === "string";

  if (!texts.length && !isMirror) {
    fail("has neither rendered text (text/one/other) nor a `use` pointer");
    continue;
  }
  if (texts.length && isMirror) {
    fail("has BOTH `use` and rendered text, and a pointer drifts from a copy of what it points at");
    continue;
  }
  if (isMirror) {
    if (entry.despite != null) fail("is a mirror and cannot carry `despite`; that field is only for a coinage that declines a near-miss");
    continue;
  }

  coined += texts.length;

  if (typeof entry.note !== "string" || entry.note.trim().length < MIN_NOTE) {
    const held = entry.note == null ? "no `note`" : `a ${entry.note.trim().length}-character note`;
    fail(`is a coinage with ${held}; say why the product has no word for this (min ${MIN_NOTE} chars)`);
  }

  for (const text of texts) {
    const n = norm(text);
    if (!n) continue;
    const duplicate = seen.get(n);
    if (duplicate) fail(`renders the same text as "${duplicate}"; one string, one key`);
    else seen.set(n, key);
    const upstream = byText.get(n);
    if (upstream && !entry.despite) {
      fail(`coins ${JSON.stringify(text)}, but the vendored catalog already has it as "${upstream}"; mirror it with {"use": "${upstream}"}, or if it genuinely cannot be used, declare {"despite": "${upstream}"} and say why in the note`);
    }
  }

  if (entry.despite != null) {
    if (!has(entry.despite)) fail(`declares despite:"${entry.despite}", which is not in the vendored catalog`);
    else if (!texts.some((t) => norm(t) === norm(product[PREFIX + entry.despite]))) {
      fail(`declares despite:"${entry.despite}", but that string does not collide with this text; a stale exemption is an exemption for nothing`);
    }
  }
}

console.log(`copycatalog · ${coined} coined strings · ${Object.keys(product).length} product keys`);
if (problems.length) {
  console.log("\nCATALOG DEFECTS - the copy allowlist is not what it claims to be:");
  for (const p of problems) console.log("  " + p);
}
process.exit(problems.length ? 1 : 0);
