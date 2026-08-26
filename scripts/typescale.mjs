#!/usr/bin/env node
// Type scale: every `font-size` in the app should name a step, not a number.
//
//   node scripts/typescale.mjs                  # whole tree
//   node scripts/typescale.mjs src/tools/memory
//   node scripts/typescale.mjs --adopt          # record today's set as the baseline
//   node scripts/typescale.mjs --prune          # drop baseline entries that no longer appear
//
// The findings come from the stylelint rule marinara/font-size-token. This file
// is the baseline ratchet over it: today's set is recorded and only growth
// fails. See scripts/lib/baseline.mjs.
//
// Exit codes: 0 clean · 1 a finding outside the baseline · 2 the check itself
// is compromised and must never read as a pass.
import { statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import stylelint from "stylelint";
import { ratchet, reportRatchet } from "./lib/baseline.mjs";
import { loadScale } from "./stylelint/font-size-token.mjs";

const RULE = "marinara/font-size-token";
const SUFFIX = ` (${RULE})`;
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const BASELINE = join(ROOT, "design", "typescale-baseline.json");

const args = process.argv.slice(2);
const adopt = args.includes("--adopt");
const prune = args.includes("--prune");
const targets = args.filter((a) => !a.startsWith("--"));

const asGlob = (target) => {
  try {
    return statSync(join(ROOT, target)).isDirectory() ? `${target}/**/*.css` : target;
  } catch {
    return target;
  }
};

const { steps, integrity } = loadScale();
const findings = [];
const inScope = new Set();
let stylesheets = 0;

try {
  const { results } = await stylelint.lint({
    cwd: ROOT,
    files: targets.length ? targets.map(asGlob) : ["src/**/*.css"],
  });
  stylesheets = results.length;
  for (const res of results) {
    const file = relative(ROOT, res.source);
    inScope.add(file);
    // Gotcha: a CSS the parser cannot read arrives as a warning whose rule is
    // CssSyntaxError, and res.parseErrors stays empty. Filtering the warnings
    // by RULE first drops it, and the run then reads as clean.
    for (const w of res.invalidOptionWarnings ?? []) integrity.push(`${file}: ${w.text}`);
    for (const w of res.warnings) {
      if (w.rule === "CssSyntaxError") integrity.push(`${file}: ${w.text}`);
      if (w.rule !== RULE) continue;
      const text = w.text.endsWith(SUFFIX) ? w.text.slice(0, -SUFFIX.length) : w.text;
      findings.push({ file, item: text.split("   ")[0], detail: text });
    }
  }
} catch (e) {
  integrity.push(`stylelint could not run: ${e.message}`);
}

console.log(`typescale · ${stylesheets} stylesheet(s) · scale: ${[...steps.keys()].join(" ") || "(none)"}`);
const off = findings.filter((f) => f.detail.endsWith("OFF THE SCALE"));
console.log(`${findings.length} literal font-size(s), ${off.length} of them off the scale entirely`);

const r = ratchet(BASELINE, findings, { adopt, prune, root: ROOT, scope: (f) => inScope.has(f) });
const code = reportRatchet({
  ...r,
  integrity: [...integrity, ...r.integrity],
  label: "design/typescale-baseline.json",
  noun: "literal font-size",
  adopt,
  prune,
});
process.exit(code);
