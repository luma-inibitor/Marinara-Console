#!/usr/bin/env node
// The pre-commit hook: check what is about to be committed, so a forgotten
// `npm run format` costs nobody a red CI run.
//
//   node scripts/precommit.mjs      # what .githooks/pre-commit runs
//
// `npm run prepare` installs it by pointing core.hooksPath at .githooks/, and
// npm runs `prepare` on its own after every `npm install`. `git commit
// --no-verify` skips it.
//
// Two things run here, both cheap: Prettier over the staged code, and
// `prosecheck` over the staged Markdown. The rest of the gate stays in
// `npm run check:static`, where a slow tool costs nothing. The hook a
// contributor keeps is the one that finishes before they notice it.
//
// ── Why a partly-staged file is reported instead of fixed ─────────────────
// Formatting a file and running `git add` on it stages the whole worktree
// copy. Where a file was staged in part — `git add -p`, or an edit made after
// staging — that sweeps the unstaged half into a commit nobody asked for. It
// is a data-loss bug wearing a convenience feature. Those files are named and
// the commit stops, so the choice stays with the author.
//
// ── Why prosecheck blocks on a suggestion ─────────────────────────────────
// The Prose CI job sets fail_on_error: false, so nothing downstream ever stops
// for Vale. Blocking here at error level alone would reproduce that, and the
// warnings and suggestions would go on accumulating, unread, in the documents
// Luma reads. The hook stops on every finding instead. `--no-verify` covers
// the case where a finding is wrong.
//
// Exit codes: 0 nothing to fix · 1 a partly-staged file needs `npm run format`
// by hand, or staged Markdown carries a Vale finding.
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const PRETTIER = join(ROOT, "node_modules", ".bin", "prettier");

/** Paths from a -z listing: NUL-separated, with a trailing NUL to discard. */
const paths = (out) => out.split("\0").filter(Boolean);

const git = (...args) => execFileSync("git", args, { cwd: ROOT, encoding: "utf8", maxBuffer: 64 << 20 });

/**
 * Split what is staged into the files safe to rewrite and the files staged
 * only in part. Exported for the test; the two sets are the whole decision.
 *
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
 * Run Prettier over `files` and return the ones it considers unformatted.
 * With `write` it fixes them first, so the list is what it changed.
 *
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
    // Without --write, Prettier exits 1 precisely because a file differs, and
    // the list is on stdout. Any other failure is real and must not pass.
    if (!write && e.status === 1 && e.stdout != null) return e.stdout.split("\n").filter(Boolean);
    throw e;
  }
}

/**
 * Vale findings on the lines this branch added, via `prosecheck --json`.
 * Returns [] when Vale is missing: an absent optional binary is not a reason
 * to stop someone committing.
 *
 * @returns {{file: string, line: number, col: number, rule: string, severity: string, message: string}[]}
 */
function proseFindings() {
  let out;
  try {
    out = execFileSync(process.execPath, [join(ROOT, "scripts", "prosecheck.mjs"), "--json"], {
      cwd: ROOT,
      encoding: "utf8",
      stdio: ["pipe", "pipe", "pipe"],
    });
  } catch (e) {
    // prosecheck exits 1 whenever an added line carries an error-level
    // finding, and prints its report regardless. A run that produced no JSON
    // at all is Vale missing or broken, which is not the author's problem.
    if (e.stdout == null || !e.stdout.trim()) return [];
    out = e.stdout;
  }
  try {
    return JSON.parse(out);
  } catch {
    return [];
  }
}

// Guarded so the module can be imported — by the test, or by anything else —
// without running the hook. docrefs.mjs and precompress.mjs do the same.
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

function main() {
  // A clone that has not run `npm install` has no Prettier to run. Blocking the
  // commit over that would punish the wrong thing.
  if (!existsSync(PRETTIER)) {
    console.error("pre-commit: no Prettier in node_modules, skipping. Run `npm install`.");
    return;
  }

  const staged = paths(git("diff", "--cached", "--name-only", "--diff-filter=ACMR", "-z"));
  const { safe, partial } = partition(staged, paths(git("diff", "--name-only", "-z")));

  if (!staged.length) return;

  const fixed = different(safe, true);
  if (fixed.length) {
    // Re-stage only what Prettier touched. These files had nothing unstaged, so
    // the worktree copy and the index copy are the same commit either way.
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

  // Only when Markdown is actually going in: prosecheck shells out to Vale over
  // the whole changed set, which is not worth paying for a code-only commit.
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
