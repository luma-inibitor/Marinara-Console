#!/usr/bin/env node
// A pull request's title and its opening paragraph.
//
//   node scripts/prcheck.mjs                       # reads $GITHUB_EVENT_PATH
//   node scripts/prcheck.mjs --title "fix: …" --body-file body.md
//
// ── The title ─────────────────────────────────────────────────────────────
// Held to the same Conventional Commits rule as a commit subject, because a
// squash merge writes the PR title as the commit subject — an unconventional
// title lands an unconventional commit on main whatever the branch's own
// commits looked like.
//
// ── The opening ───────────────────────────────────────────────────────────
// Luma reads the first two sentences and often nothing after them, so they
// have to say what was wrong and what this does about it, to someone who has
// not seen the code. Only what can be judged mechanically is asserted here:
// that an opening paragraph exists, that it is prose rather than a heading or
// a list, that it is at least two sentences, and that it does not open in the
// vocabulary of the diff — a path, a code span, a `#123`, an identifier.
//
// Deliberately NOT checked: whether the two sentences are actually the problem
// and the solution, sentence length, reading grade, and any word list. A check
// that fires on a good opening gets switched off within the week, and none of
// those can tell a good opening from a bad one.
//
// Exit codes: 0 clean · 1 the title or the opening breaks a rule · 2 the check
// could not run and must never read as a pass.

import { readFileSync } from "node:fs";
import { conventionalHelp, conventionalProblem } from "./lib/conventional.mjs";

const args = process.argv.slice(2);
function flag(name) {
  const at = args.indexOf(name);
  return at === -1 ? undefined : args[at + 1];
}

function die(reason) {
  console.error(`CANNOT CHECK: ${reason}`);
  process.exit(2);
}

// ── Reading the opening ───────────────────────────────────────────────────

// A comment is markup the reader never sees, so it is not the opening.
const COMMENT = /<!--[\s\S]*?-->/g;

const BLOCK_OPENERS = [
  [/^#{1,6}\s/, "a heading"],
  [/^[-*+]\s/, "a bullet"],
  [/^\d+[.)]\s/, "a numbered list"],
  [/^>/, "a quote"],
  [/^\|/, "a table"],
  [/^(```|~~~)/, "a code fence"],
  [/^( {4}|\t)/, "an indented code block"],
  [/^!\[/, "an image"],
  [/^<\w/, "raw HTML"],
];

// Each pattern is a way of naming a thing that only exists inside the diff.
const DIFF_VOCABULARY = [
  [/`/, "a code span"],
  [/(^|[\s(])#\d+\b/, "a `#123` cross-reference"],
  [/\b[\w-]+\.(ts|tsx|js|jsx|mjs|cjs|css|json|md|ya?ml|html|sh|toml|lock)\b/i, "a file name"],
  [/(^|\s)(src|scripts|design|public|packages|node_modules|\.github)\//, "a file path"],
  [/\b\w+\(\)/, "a function call"],
  // camelCase and snake_case are identifiers in every language here; a word a
  // person would type in a sentence is neither.
  [/\b[a-z][a-z0-9]*[A-Z][A-Za-z0-9]*\b/, "a camelCase identifier"],
  [/\b[a-z0-9]+_[a-z0-9_]+\b/, "a snake_case identifier"],
];

// A period that ends an abbreviation is not the end of a sentence. Only the
// ones that turn up in prose about software are listed; an unknown one costs a
// sentence, and the floor is two.
const ABBREVIATIONS = /\b(e\.g|i\.e|etc|vs|cf|approx|Mr|Mrs|Ms|Dr|no|fig|al)\.$/i;

export function openingOf(body) {
  const text = body.replace(COMMENT, "").replace(/\r\n/g, "\n").trim();
  if (text === "") return { text: "", paragraph: "" };
  const paragraph = text.split(/\n\s*\n/)[0].trim();
  return { text, paragraph };
}

export function countSentences(paragraph) {
  // Split after terminal punctuation followed by whitespace, keeping the
  // terminator with the sentence it ends, then drop the pieces that ended on an
  // abbreviation by gluing them to what follows.
  const pieces = paragraph.split(/(?<=[.!?]["')\]]?)\s+/);
  let count = 0;
  let carrying = false;
  for (const piece of pieces) {
    const ends = /[.!?]["')\]]?$/.test(piece) && !ABBREVIATIONS.test(piece);
    if (!ends) {
      carrying = true;
      continue;
    }
    count += 1;
    carrying = false;
  }
  // A paragraph whose last sentence has no terminal punctuation still said
  // something; count it.
  if (carrying) count += 1;
  return count;
}

export function bodyProblems(body) {
  const { text, paragraph } = openingOf(body);
  if (text === "") return ["the body is empty — it needs an opening paragraph saying what was wrong and what this does about it"];
  const problems = [];
  const opener = BLOCK_OPENERS.find(([pattern]) => pattern.test(paragraph));
  if (opener) {
    problems.push(`the body opens with ${opener[1]}, not a paragraph`);
    return problems;
  }
  if (countSentences(paragraph) < 2) {
    problems.push("the opening paragraph is one sentence — it needs at least two: what the problem is, and what this does about it");
  }
  for (const [pattern, what] of DIFF_VOCABULARY) {
    const hit = pattern.exec(paragraph);
    if (hit) problems.push(`the opening paragraph contains ${what} (${hit[0].trim()}) — it should read to someone who has not seen the code`);
  }
  return problems;
}

// ── Running it ────────────────────────────────────────────────────────────

// The rules above are imported by the tests; only a direct run checks a PR.
if (import.meta.filename === process.argv[1]) main();

function main() {
  let title = flag("--title");
  let body = flag("--body");
  const bodyFile = flag("--body-file");
  if (bodyFile !== undefined) {
    try {
      body = readFileSync(bodyFile, "utf8");
    } catch (error) {
      die(`cannot read ${bodyFile}: ${error.message}`);
    }
  }

  if (title === undefined || body === undefined) {
    const eventPath = process.env.GITHUB_EVENT_PATH;
    if (!eventPath) die("no --title/--body-file given and GITHUB_EVENT_PATH is not set");
    let event;
    try {
      event = JSON.parse(readFileSync(eventPath, "utf8"));
    } catch (error) {
      die(`cannot read the event payload at ${eventPath}: ${error.message}`);
    }
    if (!event.pull_request) die("the event payload carries no pull_request — run this on pull_request events");
    title ??= event.pull_request.title ?? "";
    body ??= event.pull_request.body ?? "";
  }

  const failures = [];
  const titleProblem = conventionalProblem(title);
  if (titleProblem) {
    failures.push(
      `The pull request TITLE breaks Conventional Commits: ${titleProblem}\n` +
        "  A squash merge writes the title as the commit subject, so the title is a commit subject.\n" +
        conventionalHelp(title),
    );
  }
  for (const problem of bodyProblems(body ?? "")) {
    failures.push(
      `The pull request BODY: ${problem}\n` +
        "\n  The first two sentences are read by someone who has not seen the diff.\n" +
        "  Example opening:\n" +
        "\n      Undo on an archived memory stopped working a few seconds before the\n" +
        "      message offering it disappeared, and nothing on screen showed that the\n" +
        "      window had closed. This gives those toasts the full undo window and the\n" +
        "      countdown that goes with it.\n" +
        "\n  Anything after that first paragraph is unchecked — headings, tables and\n" +
        "  code are all fine there.",
    );
  }

  if (failures.length > 0) {
    for (const failure of failures) console.error(`\n${failure}\n`);
    process.exit(1);
  }
  console.log("prcheck: title is conventional, opening paragraph reads as prose");
}
