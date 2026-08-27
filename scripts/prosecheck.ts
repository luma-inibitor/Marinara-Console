#!/usr/bin/env node
// Prose check: run Vale over the Markdown and the code comments this branch
// changed, and report only the alerts on lines this branch added. Mirrors what
// the Prose CI job annotates, so a clean run here means a clean annotation
// there.
//
//   node scripts/prosecheck.ts            # branch vs its merge base with main
//   node scripts/prosecheck.ts --all      # every alert in the changed files
//   node scripts/prosecheck.ts --json     # machine-readable report
//   node scripts/prosecheck.ts --base X   # diff against X instead of main
//
// Exits 1 when an added line carries an error-level alert, 0 otherwise. The CI
// job never blocks; this one does, because here the alerts are yours.
//
// ── Why .mjs needs a shim ─────────────────────────────────────────────────
// Vale reads a comment through a tree-sitter grammar it picks by file
// extension, and its extension table has no row for .mjs or .cjs. A file it
// cannot place falls through to being linted whole, code and all, which scores
// 974 identifiers as misspellings across scripts/. `.vale.ini` turns those two
// extensions off for that reason, and this script gets at them another way: a
// symlink named .js, in a mirror of the directory tree, pointing at the real
// file. The bytes are the same file, so every line and column Vale reports is
// already the one in the source and nothing needs adjusting on the way back.
//
// The mapping in `.vale.ini` covers everything else. Ordinary comment
// extraction is Vale's own; see docs/misc/vale-code-comments.md.
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";

/** Extensions `.vale.ini` lints directly. */
export const NATIVE = [".md", ".ts", ".tsx", ".js"];

/** Extensions Vale cannot place, which reach it as a `.js` symlink. */
export const SHIMMED = [".mjs", ".cjs"];

interface Alert {
  file: string;
  line: number;
  col: number;
  rule: string;
  severity: string;
  message: string;
}

/** One entry of Vale's `--output=JSON` report. */
interface ValeAlert {
  Line: number;
  Span: [number, number];
  Check: string;
  Severity: string;
  Message: string;
}

interface Options {
  all: boolean;
  json: boolean;
  /** The ref to diff against, after `--base` and the fallbacks settle it. */
  base: string;
}

function parseArgs(argv: string[]): Options {
  // indexOf returns -1 when the flag is absent, and argv[0] is the next flag.
  const baseAt = argv.indexOf("--base");
  return {
    all: argv.includes("--all"),
    json: argv.includes("--json"),
    base: mergeBase(baseAt === -1 ? null : (argv[baseAt + 1] ?? null)),
  };
}

function run(cmd: string, args: string[]): string {
  try {
    return execFileSync(cmd, args, { encoding: "utf8", maxBuffer: 64 << 20 });
  } catch (e) {
    const failure = e as { stdout?: string; code?: string };
    // Vale exits non-zero whenever it reports an error-level alert.
    if (failure.stdout != null) return failure.stdout;
    if (failure.code === "ENOENT") {
      throw new Error(`${cmd} is not on PATH; see the Prose section of README.md`);
    }
    throw e;
  }
}

function mergeBase(explicit: string | null): string {
  if (explicit) return explicit;
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

/** Added line numbers per file, straight from the unified diff hunk headers. */
export function parseAddedLines(diff: string): Map<string, Set<number>> {
  const files = new Map<string, Set<number>>();
  let lines: Set<number> | null = null;
  for (const line of diff.split("\n")) {
    if (line.startsWith("+++ b/")) {
      lines = new Set();
      files.set(line.slice(6), lines);
    }
    const hunk = /^@@ -\S+ \+(\d+)(?:,(\d+))? @@/.exec(line);
    if (hunk && lines) {
      const start = Number(hunk[1]);
      const count = hunk[2] === undefined ? 1 : Number(hunk[2]);
      for (let i = start; i < start + count; i++) lines.add(i);
    }
  }
  // A hunk that only deletes lines reports a count of 0 and adds nothing.
  return new Map([...files].filter(([, added]) => added.size > 0));
}

function addedLines(base: string): Map<string, Set<number>> {
  const globs = [...NATIVE, ...SHIMMED].map((ext) => `*${ext}`);
  return parseAddedLines(run("git", ["diff", "--unified=0", base, "--", ...globs]));
}

/**
 * Paths to hand Vale, each mapped back to the file it stands for.
 *
 * A shimmed file gets a symlink under `dir`, at its own path with a `.js`
 * extension, so two files with the same basename in different directories stay
 * apart and `.vale.ini`'s `[*.{ts,tsx,js}]` section still claims it.
 */
export function linkTargets(files: string[], dir: string): Map<string, string> {
  const targets = new Map<string, string>();
  for (const file of files) {
    const shimmed = SHIMMED.find((ext) => file.endsWith(ext));
    if (!shimmed) {
      targets.set(file, file);
      continue;
    }
    const link = join(dir, `${file.slice(0, -shimmed.length)}.js`);
    mkdirSync(dirname(link), { recursive: true });
    symlinkSync(resolve(file), link);
    targets.set(link, file);
  }
  return targets;
}

function lint(files: string[]): Alert[] {
  const dir = mkdtempSync(join(tmpdir(), "prosecheck-"));
  try {
    const targets = linkTargets(files, dir);
    const report: Record<string, ValeAlert[]> = JSON.parse(
      run("vale", ["--no-global", "--output=JSON", ...targets.keys()]) || "{}",
    );

    const alerts: Alert[] = [];
    for (const [target, list] of Object.entries(report)) {
      // Vale keys the report by the path it was given, which for a shimmed
      // file is the symlink. The bytes behind it are the real file's, so the
      // line and column carry over untouched.
      const file = targets.get(target) ?? target;
      for (const a of list) {
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
    return alerts;
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

function report(alerts: Alert[], added: Map<string, Set<number>>, options: Options): void {
  if (options.json) {
    console.log(JSON.stringify(alerts, null, 2));
    return;
  }
  for (const a of alerts) {
    console.log(`${a.file}:${a.line}:${a.col}:${a.rule}:${a.message}`);
  }
  const errors = alerts.filter((a) => a.severity === "error").length;
  const scope = options.all ? "changed files" : "added lines";
  console.log(
    `\nprosecheck: ${alerts.length} alert(s) on ${scope} in ${added.size} file(s), ` +
      `${errors} error(s). Base ${options.base.slice(0, 8)}.`,
  );
  if (!options.all && alerts.length) {
    console.log("Run with --all to see everything in these files.");
  }
}

function main(argv: string[]): number {
  const options = parseArgs(argv);
  const added = addedLines(options.base);

  if (added.size === 0) {
    if (options.json) console.log("[]");
    else console.log(`prosecheck: nothing lintable changed against ${options.base.slice(0, 8)}`);
    return 0;
  }

  const alerts = lint([...added.keys()])
    .filter((a) => options.all || added.get(a.file)?.has(a.line))
    .sort((x, y) => x.file.localeCompare(y.file) || x.line - y.line || x.col - y.col);

  report(alerts, added, options);
  return alerts.some((a) => a.severity === "error") ? 1 : 0;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  process.exit(main(process.argv.slice(2)));
}
