#!/usr/bin/env node
// Fails when the index holds a build artifact, a capture, a stray lockfile or local scratch.
import { execFileSync } from "node:child_process";

// These rules still hold after someone edits .gitignore.
const RULES = [
  [/^(dist|storybook-static|playwright-report|test-results)\//, "build output"],
  [/(^|\/)node_modules\//, "installed dependencies"],
  [/^shots\/|(^|\/)_screenshots\//, "captured screenshots"],
  [/\.(png|jpe?g|gif|webp|avif|bmp|ico)$/i, "captured image"],
  [/^design\/research\//, "vendored research"],
  [/^(\.backups|\.state|\.claude|\.decisions|\.ds-sync|ds-bundle)\//, "local scratch directory"],
  [/^\.design-sync\/(\.cache|learnings|node_modules)\//, "design-sync scratch"],
  [/^\.design-sync\/ds-entry\.css$/, "generated design-sync entry"],
  [/(^|\/)entries\.json$/, "engine data dump"],
  [/^mockups\/data\.js$/, "generated mockup data"],
  [/(^|\/)(yarn\.lock|pnpm-lock\.yaml|bun\.lockb?)$/, "wrong lockfile for an npm repo"],
  [/\.(tsbuildinfo|log)$/, "tool scratch"],
  [/(^|\/)\.env(\.|$)/, "environment file"],
  [/(^|\/)\.DS_Store$/, "Finder metadata"],
];

// The server tests serve their fixtures as real files.
const FIXTURES = /^(test|scripts)\/fixtures\//;

/** @type {(args: string[]) => string[]} */
const git = (args) => {
  try {
    return execFileSync("git", args, { encoding: "utf8" }).split("\n").filter(Boolean);
  } catch (e) {
    console.error(`git ${args.join(" ")} failed: ${String(e).split("\n")[0]}`);
    process.exit(2);
  }
};

const tracked = git(["ls-files"]);
const findings = new Map();
for (const file of tracked) {
  if (FIXTURES.test(file)) continue;
  const rule = RULES.find(([re]) => /** @type {RegExp} */ (re).test(file));
  if (rule) findings.set(file, rule[1]);
}
for (const file of git(["ls-files", "-i", "-c", "--exclude-standard"])) {
  if (!findings.has(file)) findings.set(file, "tracked despite matching .gitignore");
}

if (!findings.size) {
  console.log(`${tracked.length} tracked files, nothing that shouldn't be`);
  process.exit(0);
}
console.log(`${findings.size} file(s) must not be tracked:`);
for (const file of [...findings.keys()].sort()) console.log(`  ${file}: ${findings.get(file)}`);
console.log("\nRun `git rm --cached <path>` on each, then commit the removal.");
process.exit(1);
