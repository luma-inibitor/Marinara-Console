#!/usr/bin/env node
// Prose check: run Vale over the Markdown this branch changed, and report only
// the alerts on lines this branch added. Mirrors what the Prose CI job
// annotates, so a clean run here means a clean annotation there.
//
//   node scripts/prosecheck.mjs            # branch vs its merge base with main
//   node scripts/prosecheck.mjs --all      # every alert in the changed files
//   node scripts/prosecheck.mjs --json     # machine-readable report
//   node scripts/prosecheck.mjs --base X   # diff against X instead of main
//
// Exits 1 when an added line carries an error-level alert, 0 otherwise. The CI
// job never blocks; this one does, because here the alerts are yours.

import { execFileSync } from "node:child_process";

const argv = process.argv.slice(2);
const JSON_MODE = argv.includes("--json");
const ALL = argv.includes("--all");
// indexOf returns -1 when the flag is absent, and argv[0] is the next flag.
const baseAt = argv.indexOf("--base");
const BASE = baseAt === -1 ? null : argv[baseAt + 1] || null;

const run = (cmd, args) => {
  try {
    return execFileSync(cmd, args, { encoding: "utf8", maxBuffer: 64 << 20 });
  } catch (e) {
    // Vale exits non-zero whenever it reports an error-level alert.
    if (e.stdout != null) return e.stdout;
    throw e;
  }
};

function mergeBase() {
  if (BASE) return BASE;
  for (const ref of ["origin/main", "main"]) {
    try {
      return execFileSync("git", ["merge-base", ref, "HEAD"], {
        encoding: "utf8",
        stdio: ["pipe", "pipe", "ignore"],
      }).trim();
    } catch {
      /* try the next ref */
    }
  }
  throw new Error("no main or origin/main to diff against; pass --base <ref>");
}

// Added line numbers per file, straight from the unified diff hunk headers.
function addedLines(base) {
  const diff = run("git", ["diff", "--unified=0", base, "--", "*.md"]);
  const files = new Map();
  let file = null;
  for (const line of diff.split("\n")) {
    if (line.startsWith("+++ b/")) {
      file = line.slice(6);
      files.set(file, new Set());
    }
    const m = /^@@ -\S+ \+(\d+)(?:,(\d+))? @@/.exec(line);
    if (m && file) {
      const start = Number(m[1]);
      const count = m[2] === undefined ? 1 : Number(m[2]);
      for (let i = start; i < start + count; i++) files.get(file).add(i);
    }
  }
  // A hunk that only deletes lines reports a count of 0 and adds nothing.
  return new Map([...files].filter(([, lines]) => lines.size > 0));
}

const base = mergeBase();
const added = addedLines(base);

if (added.size === 0) {
  if (JSON_MODE) console.log("[]");
  else console.log(`prosecheck: no Markdown changed against ${base.slice(0, 8)}`);
  process.exit(0);
}

const report = JSON.parse(
  run("vale", ["--no-global", "--output=JSON", ...added.keys()]) || "{}",
);

const alerts = [];
for (const [file, list] of Object.entries(report)) {
  for (const a of list) {
    if (!ALL && !added.get(file)?.has(a.Line)) continue;
    alerts.push({
      file,
      line: a.Line,
      col: a.Span[0],
      rule: a.Check,
      severity: a.Severity,
      message: a.Message,
    });
  }
}
alerts.sort((x, y) => x.file.localeCompare(y.file) || x.line - y.line);

if (JSON_MODE) {
  console.log(JSON.stringify(alerts, null, 2));
} else {
  for (const a of alerts) {
    console.log(`${a.file}:${a.line}:${a.col}:${a.rule}:${a.message}`);
  }
  const errors = alerts.filter((a) => a.severity === "error").length;
  const scope = ALL ? "changed files" : "added lines";
  console.log(
    `\nprosecheck: ${alerts.length} alert(s) on ${scope} in ${added.size} file(s), ` +
      `${errors} error(s). Base ${base.slice(0, 8)}.`,
  );
  if (!ALL && alerts.length) {
    console.log("Run with --all to see everything in these files.");
  }
}

process.exit(alerts.some((a) => a.severity === "error") ? 1 : 0);
