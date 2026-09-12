#!/usr/bin/env node
// The pre-commit hook runs Prettier over the staged code and prosecheck over the staged Markdown.
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const PRETTIER = join(ROOT, "node_modules", ".bin", "prettier");

const paths = (out) => out.split("\0").filter(Boolean);

const git = (...args) => execFileSync("git", args, { cwd: ROOT, encoding: "utf8", maxBuffer: 64 << 20 });

/**
 * @param {string[]} staged Paths with staged changes.
 * @param {string[]} unstaged Paths whose worktree copy differs from the index.
 * @returns {{ safe: string[], partial: string[] }}
 */
export function partition(staged, unstaged) {
  const dirty = new Set(unstaged);
  return {
    safe: staged.filter((p) => !dirty.has(p)),
    partial: staged.filter((p) => dirty.has(p)),
  };
}

/**
 * @param {string[]} files
 * @param {boolean} write
 * @returns {string[]}
 */
function different(files, write) {
  if (!files.length) return [];
  const args = ["--list-different", "--ignore-unknown", ...(write ? ["--write"] : []), "--", ...files];
  try {
    return execFileSync(PRETTIER, args, { cwd: ROOT, encoding: "utf8" }).split("\n").filter(Boolean);
  } catch (e) {
    // Without --write, Prettier exits 1 when a file differs and lists it on stdout.
    if (!write && e.status === 1 && e.stdout != null) return e.stdout.split("\n").filter(Boolean);
    throw e;
  }
}

/**
 * @returns {{file: string, line: number, col: number, rule: string, severity: string, message: string}[]}
 */
function proseFindings() {
  /**
   * @param {string} detail
   * @returns {[]}
   */
  const unlinted = (detail) => {
    console.error(`pre-commit: prosecheck could not run, so the staged Markdown is unlinted.\n${detail.trim()}`);
    return [];
  };

  let out;
  try {
    out = execFileSync(process.execPath, [join(ROOT, "scripts", "prosecheck.mjs"), "--json"], {
      cwd: ROOT,
      encoding: "utf8",
      stdio: ["pipe", "pipe", "pipe"],
    });
  } catch (e) {
    if (e.status !== 1) return unlinted(e.stderr || e.message);
    out = e.stdout;
  }
  try {
    return JSON.parse(out);
  } catch {
    return unlinted(out);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

function main() {
  if (!existsSync(PRETTIER)) {
    console.error("pre-commit: no Prettier in node_modules, skipping. Run `npm install`.");
    return;
  }

  const staged = paths(git("diff", "--cached", "--name-only", "--diff-filter=ACMR", "-z"));
  const { safe, partial } = partition(staged, paths(git("diff", "--name-only", "-z")));

  if (!staged.length) return;

  const fixed = different(safe, true);
  if (fixed.length) {
    git("add", "--", ...fixed);
    console.error(`pre-commit: formatted and re-staged ${fixed.length} file(s):`);
    for (const f of fixed) console.error(`  ${f}`);
  }

  const blocked = different(partial, false);
  if (blocked.length) {
    console.error(`\npre-commit: ${blocked.length} file(s) are unformatted AND carry unstaged edits:`);
    for (const f of blocked) console.error(`  ${f}`);
    console.error(
      "\nFormatting these would stage edits you did not `git add`. Run `npm run format`,\n" +
        "stage what you meant to, and commit again — or `git commit --no-verify` to skip.",
    );
  }

  const prose = staged.some((p) => p.endsWith(".md")) ? proseFindings() : [];
  if (prose.length) {
    console.error(`\npre-commit: ${prose.length} prose finding(s) on lines this branch added:`);
    for (const a of prose) console.error(`  ${a.file}:${a.line}:${a.col} ${a.rule} — ${a.message}`);
    console.error(
      "\nFix every one, the warnings and suggestions included — CI's prose job is\n" +
        "advisory, so this is the only place they get read. `npm run prosecheck -- --all`\n" +
        "shows everything in the changed files. `git commit --no-verify` skips.",
    );
  }

  process.exit(blocked.length || prose.length ? 1 : 0);
}
