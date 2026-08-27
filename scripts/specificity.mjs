#!/usr/bin/env node
// Descending specificity: a low-specificity rule that comes after a higher one
// it overlaps loses to it wherever both match, so the later rule reads as if it
// applies and does not.
//
//   node scripts/specificity.mjs                # whole tree
//   node scripts/specificity.mjs src/ui
//   node scripts/specificity.mjs --adopt        # record today's set as the baseline
//   node scripts/specificity.mjs --prune        # drop baseline entries that no longer appear
//
// The baseline ratchet over stylelint's no-descending-specificity: today's set
// is recorded and only growth fails. See scripts/lib/baseline.mjs.
//
// Exit codes: 0 clean · 1 a finding outside the baseline · 2 the check itself
// is compromised and must never read as a pass.
import { existsSync, statSync } from "node:fs";
import { dirname, join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import stylelint from "stylelint";
import { ratchet, reportRatchet } from "./lib/baseline.mjs";

const RULE = "no-descending-specificity";
const SUFFIX = ` (${RULE})`;
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const BASELINE = join(ROOT, "design", "specificity-baseline.json");

const args = process.argv.slice(2);
const adopt = args.includes("--adopt");
const prune = args.includes("--prune");
const [arg] = args.filter((a) => !a.startsWith("--"));

const target = arg ?? "src";
if (!existsSync(join(ROOT, target))) {
  console.error(`NOTHING TO CHECK — "${target}" is not a path in this tree`);
  process.exit(2);
}
const scanned = target.split(sep).join("/").replace(/\/+$/, "");
const files = statSync(join(ROOT, target)).isDirectory() ? `${scanned}/**/*.css` : scanned;
// Gotcha: scope by path, not by the files stylelint read. A deleted stylesheet
// is never read, so its entries would survive --prune forever.
const scope = (f) => f === scanned || f.startsWith(scanned + "/");

const integrity = [];
const findings = [];
let stylesheets = 0;

try {
  const { results } = await stylelint.lint({ cwd: ROOT, files: [files] });
  stylesheets = results.length;
  for (const res of results) {
    const file = relative(ROOT, res.source).split(sep).join("/");
    // Gotcha: a CSS the parser cannot read arrives as a warning whose rule is
    // CssSyntaxError, and res.parseErrors stays empty. Filtering the warnings
    // by RULE first drops it, and the run then reads as clean.
    for (const w of res.invalidOptionWarnings ?? []) integrity.push(`${file}: ${w.text}`);
    for (const w of res.warnings) {
      if (w.rule === "CssSyntaxError") integrity.push(`${file}: ${w.text}`);
      if (w.rule !== RULE) continue;
      const text = w.text.endsWith(SUFFIX) ? w.text.slice(0, -SUFFIX.length) : w.text;
      // The message carries the overriding rule's line number. Baseline items
      // hold no line numbers, or every edit above a finding churns the record.
      findings.push({ file, item: text.replace(/, at line \d+$/, ""), detail: text });
    }
  }
} catch (e) {
  integrity.push(`stylelint could not run: ${e.message}`);
}

console.log(`specificity · ${stylesheets} stylesheet(s) under ${scanned}`);
console.log(`${findings.length} rule(s) that come after a higher-specificity rule they overlap`);

const r = ratchet(BASELINE, findings, { adopt, prune, scope });
process.exit(
  reportRatchet({
    ...r,
    integrity: [...integrity, ...r.integrity],
    label: "design/specificity-baseline.json",
    noun: "descending-specificity finding",
    adopt,
    prune,
  }),
);
