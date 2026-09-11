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
// Exit codes: 0 no error-level alert on an added line · 1 at least one · 2 Vale
// could not run, which must never read as a clean report.

import { execFileSync, spawnSync } from "node:child_process";

const argv = process.argv.slice(2);
const JSON_MODE = argv.includes("--json");
const ALL = argv.includes("--all");
// indexOf returns -1 when the flag is absent, and argv[0] is the next flag.
const baseAt = argv.indexOf("--base");
const BASE = baseAt === -1 ? null : argv[baseAt + 1] || null;

const git = (...args) => execFileSync("git", args, { encoding: "utf8", maxBuffer: 64 << 20 });

/**
 * @param {string} text
 * @returns {string[]}
 */
const lines = (text) => text.trim().split("\n").filter(Boolean);

/**
 * @param {string[]} detail
 * @returns {never}
 */
function die(...detail) {
  console.error("PROSECHECK CANNOT RUN VALE — the check itself is compromised:");
  for (const line of detail) console.error("  " + line);
  process.exit(2);
}

/**
 * @param {string[]} args
 * @returns {{ status: number, stdout: string, stderr: string }}
 */
function vale(...args) {
  const r = spawnSync("vale", ["--no-global", ...args], { encoding: "utf8", maxBuffer: 64 << 20 });
  if (r.error) {
    if (/** @type {NodeJS.ErrnoException} */ (r.error).code === "ENOENT") {
      die("vale is not on PATH.", "Install it with `brew install vale`, or see https://vale.sh/docs/install.");
    }
    die(`vale could not start: ${r.error.message}`);
  }
  return { status: r.status ?? -1, stdout: r.stdout, stderr: r.stderr };
}

/**
 * Vale's report for `files`, as `{ file: alert[] }`.
 *
 * Vale exits 0 with a clean report, 1 when it has alerts to show, and anything
 * else on a runtime error it describes on stderr with nothing on stdout. That
 * last case was reaching the parse as an empty string and reading as a clean
 * report, which is how a whole branch of Markdown passed unlinted.
 *
 * .vale/styles holds downloaded packages and is not version controlled, so a
 * fresh clone or worktree has none until `vale sync` runs. Syncing here rather
 * than in `npm run prepare` puts it at the moment the styles are needed: a
 * worktree gets its own empty styles directory without a second `npm install`,
 * and an install that reaches for the network is an install that fails offline.
 *
 * @param {string[]} files
 * @returns {Record<string, { Line: number, Span: number[], Check: string, Severity: string, Message: string }[]>}
 */
function report(files) {
  let r = vale("--output=JSON", ...files);
  if (r.status > 1 && r.stderr.includes("StylesPath")) {
    console.error("prosecheck: styles missing from .vale/styles, running `vale sync`");
    const sync = vale("sync");
    if (sync.status !== 0) {
      die("`vale sync` failed, so the styles .vale.ini names are still missing.", ...lines(sync.stderr || sync.stdout));
    }
    r = vale("--output=JSON", ...files);
  }
  if (r.status !== 0 && r.status !== 1) {
    die(`vale exited ${r.status} without a report.`, ...lines(r.stderr || r.stdout));
  }
  try {
    return JSON.parse(r.stdout);
  } catch {
    die(`vale exited ${r.status} but its report is not JSON.`, ...lines(r.stdout));
  }
}

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
  const diff = git("diff", "--unified=0", base, "--", "*.md");
  const files = new Map();
  let file = /** @type {string | null} */ (null);
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

const alertsByFile = report([...added.keys()]);

const alerts = [];
for (const [file, list] of Object.entries(alertsByFile)) {
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
