#!/usr/bin/env node
// Checks a pull request title as a commit subject (a squash merge writes it as
// one) and its opening paragraph as prose. Later paragraphs are unchecked.
//
//   node scripts/prcheck.mjs [--title <text> --body <text>]  # else $GITHUB_EVENT_PATH

import { readFileSync } from "node:fs";
import { conventionalHelp, conventionalProblem } from "./lib/conventional.mjs";

const args = process.argv.slice(2);
const flag = (name) => (args.includes(name) ? args[args.indexOf(name) + 1] : undefined);

const JARGON = [
  [/`/, "a code span"],
  [/(^|[\s(])#\d+\b/, "a `#123` cross-reference"],
  [/[\w-]+\.(ts|tsx|js|jsx|mjs|cjs|css|json|md|ya?ml|html|sh)\b/i, "a file name"],
  [/(^|\s)(src|scripts|design|public|packages|\.github)\//, "a file path"],
];

export function bodyProblems(body) {
  const opening = body.replace(/<!--[\s\S]*?-->/g, "").trim().split(/\n\s*\n/)[0].trim();
  if (opening === "") return ["the body is empty — it needs an opening paragraph"];
  if (/^(#{1,6}\s|[-*+]\s|\d+[.)]\s|```|~~~)/.test(opening))
    return ["the body opens with a heading, list or code fence, not a paragraph"];
  const problems = [];
  // An abbreviation's period reads as a sentence end, which can only overcount.
  if ((opening.match(/[.!?](\s|$)/g) ?? []).length < 2)
    problems.push("the opening paragraph is one sentence — it needs two: what the problem is, and what this does about it");
  for (const [pattern, what] of JARGON)
    if (pattern.test(opening)) problems.push(`the opening paragraph contains ${what} — it should read to someone who has not seen the code`);
  return problems;
}

// The tests import the rule above; only a direct run checks a pull request.
if (import.meta.filename === process.argv[1]) main();

function main() {
  const path = process.env.GITHUB_EVENT_PATH;
  const event = path ? JSON.parse(readFileSync(path, "utf8")).pull_request : undefined;
  const title = flag("--title") ?? event?.title;
  // GitHub sends a null body for an empty one; that is a failure, not a miss.
  const body = flag("--body") ?? (event && (event.body ?? ""));
  if (title === undefined || body === undefined) {
    console.error("CANNOT CHECK: no --title/--body given and no pull_request event payload to read");
    process.exit(2);
  }

  const titleProblem = conventionalProblem(title);
  const failures = bodyProblems(body).map((problem) => `The pull request BODY: ${problem}`);
  if (titleProblem)
    failures.unshift(
      `The pull request TITLE breaks Conventional Commits (a squash merge writes it as the commit subject): ${titleProblem}\n${conventionalHelp(title)}`,
    );
  if (failures.length > 0) {
    for (const failure of failures) console.error(`\n${failure}\n`);
    process.exit(1);
  }
  console.log("prcheck: title is conventional, opening paragraph reads as prose");
}
