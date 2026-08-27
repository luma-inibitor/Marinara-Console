#!/usr/bin/env node
// Point git at .githooks/, so the pre-commit hook installs itself.
//
//   node scripts/prepare.mjs      # npm runs this after every install
//
// A hook under .git/hooks/ is not version controlled and reaches only the
// person who ran the installer. core.hooksPath moves the directory into the
// tree, where the hook is reviewed with the code it guards and arrives with a
// clone. The one local step is this line of config, and npm's `prepare`
// lifecycle runs it unprompted.
//
// This never fails an install. A tarball with no .git, a git too old for
// core.hooksPath, a sandbox with no git on PATH: each means no hook, which is
// the state every contributor was in before this file existed.
import { execFileSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const WANT = ".githooks";

const git = (...args) => execFileSync("git", args, { cwd: ROOT, encoding: "utf8", stdio: ["pipe", "pipe", "ignore"] });

try {
  git("rev-parse", "--git-dir");
} catch {
  process.exit(0); // Not a working copy. Nothing to hook.
}

let current = "";
try {
  current = git("config", "--local", "core.hooksPath").trim();
} catch {
  /* unset, which is the usual case */
}

if (current === WANT) process.exit(0);

// Someone pointed this elsewhere on purpose. Say so rather than stamping over
// a decision that is not ours to make.
if (current) {
  console.error(`prepare: core.hooksPath is "${current}", leaving it. Set it to "${WANT}" to enable the hooks.`);
  process.exit(0);
}

try {
  git("config", "--local", "core.hooksPath", WANT);
  console.log(`prepare: git hooks enabled from ${WANT}/`);
} catch {
  console.error(`prepare: could not set core.hooksPath, so ${WANT}/ is inactive. Formatting is still checked in CI.`);
}
