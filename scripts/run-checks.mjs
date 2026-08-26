#!/usr/bin/env node
// Run every check named in scripts/checks.mjs. This is `npm run check:static`.
//
//   node scripts/run-checks.mjs
//
// ── Why this does not stop at the first failure ───────────────────────────
// The `&&` chain it replaces stopped at the first non-zero exit, so a run that
// failed `typecheck` said nothing about the seven tools behind it. Fix the type
// error, run again, watch the next tool fail: the same wait paid once per
// defect, and — worse — a green run after one fix reads as a finished change
// when three other tools were never reached. Every check runs, and every
// failure is in the summary, so one run is one complete list of what is wrong.
//
// Each check keeps its own stdout. These tools print findings, and a runner
// that buffered them would either lose them or float them away from the heading
// that says which tool is speaking.
//
// Exit codes: 0 every check passed · 1 at least one check failed · 2 the list
// itself is broken, which must never read as a pass.
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

const integrityFailure = (...lines) => {
  console.error("CHECK LIST INTEGRITY FAILURE — the run itself is compromised:");
  for (const line of lines) console.error("  " + line);
  process.exit(2);
};

let checks;
try {
  ({ checks } = await import("./checks.mjs"));
} catch (e) {
  integrityFailure(`scripts/checks.mjs is unreadable: ${e.message}`);
}
if (!Array.isArray(checks) || !checks.length) {
  integrityFailure("scripts/checks.mjs must export a non-empty `checks` array");
}
if (checks.some((name) => typeof name !== "string" || !name.trim())) {
  integrityFailure("every entry in `checks` must be a non-empty npm script name");
}

let scripts;
try {
  scripts = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8")).scripts || {};
} catch (e) {
  integrityFailure(`package.json is unreadable: ${e.message}`);
}

// A name with no script behind it is a defect in the list, not a failing tool:
// it is what a rename looks like when one of the two edits arrives without the
// other. `npm run` exits 1 on it, which would read as a real finding.
const missing = checks.filter((name) => !(name in scripts));
if (missing.length) {
  integrityFailure(...missing.map((name) => `"${name}" names no script in package.json`));
}

// Two branches that add the same tool each add a line, and git keeps both.
const duplicated = [...new Set(checks.filter((name, i) => checks.indexOf(name) !== i))];
if (duplicated.length) {
  integrityFailure(...duplicated.map((name) => `"${name}" appears more than once in the list`));
}

// Use the npm that started this script — npm sets `npm_execpath` for anything
// it runs — so `check:static` cannot reach a different npm than the rest of the
// chain did. Falling back to PATH covers a direct `node scripts/run-checks.mjs`.
const execpath = process.env.npm_execpath;
const [command, prefix] = execpath ? [process.execPath, [execpath]] : ["npm", []];

const results = [];
for (const name of checks) {
  console.log(`\n── ${name} ` + "─".repeat(Math.max(0, 68 - name.length)));
  const started = Date.now();
  const run = spawnSync(command, [...prefix, "run", name], { cwd: ROOT, stdio: "inherit" });
  if (run.error) integrityFailure(`could not run "${name}": ${run.error.message}`);
  results.push({
    name,
    seconds: (Date.now() - started) / 1000,
    // A signal is not an exit code, and a check killed by one has not passed.
    outcome: run.signal ? `killed by ${run.signal}` : run.status === 0 ? "" : `exit ${run.status}`,
  });
}

const width = Math.max(...results.map((r) => r.name.length));
console.log("\ncheck:static");
for (const r of results) {
  const verdict = r.outcome ? `FAIL  ${r.name.padEnd(width)}  ${r.outcome}` : `ok    ${r.name.padEnd(width)}`;
  console.log(`  ${verdict.padEnd(width + 16)}${r.seconds.toFixed(1)}s`);
}

const failed = results.filter((r) => r.outcome);
console.log(
  failed.length
    ? `\n${failed.length} of ${results.length} checks FAILED: ${failed.map((r) => r.name).join(", ")}`
    : `\nall ${results.length} checks pass`,
);
process.exit(failed.length ? 1 : 0);
