#!/usr/bin/env node
// Package hygiene: the npm-init placeholder fields stay deleted, the licence
// stays declared, and .gitignore lists each pattern once.
//
//   node scripts/pkgcheck.mjs
//   node scripts/pkgcheck.mjs path/to/other/root
//
// Exit codes: 0 clean · 1 a finding · 2 the check itself could not read its
// inputs, which must never read as a pass.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const DEFAULT_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const ROOT = process.argv[2] ? join(process.cwd(), process.argv[2]) : DEFAULT_ROOT;

// The four fields `npm init` writes that this app has no use for.
const BANNED = ["main", "description", "keywords", "author"];

const integrityFailure = (message) => {
  console.error(`INTEGRITY FAILURE — ${message}`);
  process.exit(2);
};

const read = (name) => {
  try {
    return readFileSync(join(ROOT, name), "utf8");
  } catch (e) {
    integrityFailure(`${name} is unreadable: ${e.message}`);
  }
};

let pkg;
try {
  pkg = JSON.parse(read("package.json"));
} catch (e) {
  integrityFailure(`package.json is not valid JSON: ${e.message}`);
}

const findings = [];

for (const field of BANNED) {
  if (field in pkg) findings.push(`package.json still has "${field}"`);
}

if (typeof pkg.license !== "string" || !pkg.license.trim()) {
  findings.push('package.json needs a non-empty "license"');
}

const patterns = read(".gitignore")
  .split("\n")
  .map((line, i) => ({ pattern: line.trim(), line: i + 1 }))
  .filter(({ pattern }) => pattern && !pattern.startsWith("#"));

const seen = new Map();
for (const { pattern, line } of patterns) {
  if (seen.has(pattern)) findings.push(`.gitignore repeats "${pattern}" on lines ${seen.get(pattern)} and ${line}`);
  else seen.set(pattern, line);
}

if (findings.length) {
  for (const finding of findings) console.log(`  ${finding}`);
  console.log(`\n${findings.length} package hygiene ${findings.length === 1 ? "finding" : "findings"}`);
  process.exit(1);
}

console.log("package.json clean");
