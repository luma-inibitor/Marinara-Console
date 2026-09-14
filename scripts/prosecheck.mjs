#!/usr/bin/env node
// Runs Vale over the Markdown this branch changed and reports the alerts on added lines.

import { execFileSync, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const argv = process.argv.slice(2);
const JSON_MODE = argv.includes("--json");
const ALL = argv.includes("--all");
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
 * Vale exits 0 when clean, 1 with alerts, and 2 on a runtime error.
 *
 * @param {string[]} files
 * @returns {Record<string, { Line: number, Span: number[], Check: string, Severity: string, Message: string }[]>}
 */
// Vale unpacks a package's own .vale.ini here. The Luma package carries the
// `[*.md]` section and every rule, so without it the root .vale.ini names no
// style and no file: Vale checks nothing, reports nothing, and exits 0.
const PACKAGE_CONFIG = join(dirname(fileURLToPath(import.meta.url)), "..", ".vale", "styles", ".vale-config");

function sync() {
  // Syncing here keeps `bun install` working offline.
  console.error("prosecheck: the Luma package is missing from .vale/styles, running `vale sync`");
  const r = vale("sync");
  if (r.status !== 0) {
    die("`vale sync` failed, so the styles .vale.ini names are still missing.", ...lines(r.stderr || r.stdout));
  }
}

function report(files) {
  if (!existsSync(PACKAGE_CONFIG)) sync();
  let r = vale("--output=JSON", ...files);
  if (r.status > 1 && r.stderr.includes("StylesPath")) {
    sync();
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
