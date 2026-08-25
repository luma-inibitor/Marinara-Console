#!/usr/bin/env node
// Refuse to let a build artifact, a captured image, an alternate lockfile or a
// local scratch directory sit in the index.
//
// RULES is not redundant with .gitignore: once a file is committed .gitignore
// never looks at it again, so the list is the floor that survives someone
// editing .gitignore.
import { execFileSync } from "node:child_process";

const RULES = [
  [/^dist\//, "build output"],
  [/(^|\/)node_modules\//, "installed dependencies"],
  [/^shots\/|(^|\/)_screenshots\//, "captured screenshots"],
  [/\.(png|jpe?g|gif|webp|avif|bmp|ico)$/i, "captured image — regenerable, never source"],
  [/^design\/research\//, "vendored research, not a build input"],
  [/^(\.backups|\.state|\.claude|\.decisions|\.ds-sync|ds-bundle)\//, "local scratch directory"],
  [/^\.design-sync\/(\.cache|learnings|node_modules)\//, "design-sync scratch"],
  [/^\.design-sync\/ds-entry\.css$/, "generated design-sync entry"],
  [/(^|\/)entries\.json$/, "engine data dump"],
  [/^mockups\/data\.js$/, "generated mockup data"],
  [/(^|\/)(yarn\.lock|pnpm-lock\.yaml|bun\.lockb?)$/, "wrong lockfile — this repo installs with npm"],
  [/\.(tsbuildinfo|log)$/, "tool scratch"],
  [/(^|\/)\.env(\.|$)/, "environment file"],
  [/(^|\/)\.DS_Store$/, "Finder metadata"],
];

const git = (args) => {
  try {
    return execFileSync("git", args, { encoding: "utf8" }).split("\n").filter(Boolean);
  } catch (e) {
    console.log(`git ${args.join(" ")} failed: ${String(e).split("\n")[0]}`);
    process.exit(2);
  }
};

const tracked = git(["ls-files"]);
const findings = new Map();
for (const file of tracked) {
  const rule = RULES.find(([re]) => re.test(file));
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
for (const file of [...findings.keys()].sort()) console.log(`  ${file} — ${findings.get(file)}`);
console.log("\nRun `git rm --cached <path>` on each, then commit the removal.");
process.exit(1);
