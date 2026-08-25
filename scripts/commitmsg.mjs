#!/usr/bin/env node
// Commit subjects follow Conventional Commits 1.0.0. Same rule in two places it
// can be applied: the local commit-msg hook, and a sweep over a pull request's
// commits in CI, because a hook can be skipped.
//
//   node scripts/commitmsg.mjs .git/COMMIT_EDITMSG   # what the hook passes
//   node scripts/commitmsg.mjs --message "feat: add a thing"
//   node scripts/commitmsg.mjs --range origin/main..HEAD
//
// Merge, revert and fixup subjects are git's own wording, not the author's, and
// are skipped. History before this check exists is not swept: the rule applies
// to what a branch adds, so the range is the pull request's commits.
//
// Exit codes: 0 clean · 1 a subject breaks the rule · 2 the check could not run
// and must never read as a pass.

import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { conventionalHelp, conventionalProblem, isGenerated, subjectOf } from "./lib/conventional.mjs";

const args = process.argv.slice(2);

function fail(problem, subject) {
  console.error(`\n  Commit message rejected: ${problem}\n`);
  console.error(conventionalHelp(subject));
  console.error("\n  `git commit --no-verify` skips this hook; CI checks the same rule.\n");
  process.exit(1);
}

function die(reason) {
  console.error(`CANNOT CHECK: ${reason}`);
  process.exit(2);
}

const rangeAt = args.indexOf("--range");
const messageAt = args.indexOf("--message");

if (rangeAt !== -1) {
  const range = args[rangeAt + 1];
  if (!range) die("--range needs a revision range");
  let log;
  try {
    // A NUL between records; a subject cannot contain one, a body can contain
    // anything else a delimiter might have used.
    log = execFileSync("git", ["log", "--no-merges", "--format=%s%x00", range], { encoding: "utf8" });
  } catch (error) {
    die(`git log ${range} failed: ${error.message}`);
  }
  const subjects = log.split("\0").map((s) => s.replace(/^\n/, "")).filter((s) => s !== "");
  if (subjects.length === 0) die(`${range} names no commits`);
  const bad = [];
  for (const subject of subjects) {
    if (isGenerated(subject)) continue;
    const problem = conventionalProblem(subject);
    if (problem) bad.push([subject, problem]);
  }
  if (bad.length > 0) {
    console.error(`\n  ${bad.length} of ${subjects.length} commit subjects break Conventional Commits:\n`);
    for (const [subject, problem] of bad) console.error(`    ${subject}\n      — ${problem}`);
    console.error(`\n${conventionalHelp(bad[0][0])}`);
    console.error("\n  Reword them with `git rebase -i` and force-push the branch.\n");
    process.exit(1);
  }
  console.log(`commitmsg: ${subjects.length} subject${subjects.length === 1 ? "" : "s"} in ${range}, all conventional`);
  process.exit(0);
}

let subject;
if (messageAt !== -1) {
  if (args[messageAt + 1] === undefined) die("--message needs a message");
  subject = subjectOf(args[messageAt + 1]);
} else {
  const path = args.find((a) => !a.startsWith("--"));
  if (!path) die("give a message file, --message, or --range");
  try {
    subject = subjectOf(readFileSync(path, "utf8"));
  } catch (error) {
    die(`cannot read ${path}: ${error.message}`);
  }
}

if (isGenerated(subject)) process.exit(0);
const problem = conventionalProblem(subject);
if (problem) fail(problem, subject);
