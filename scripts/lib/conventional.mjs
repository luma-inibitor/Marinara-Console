// The Conventional Commits 1.0.0 subject rule, and the one place it is stated.
// The commit-msg hook, the CI commit sweep and the PR-title check all read it
// from here so a skipped hook and a green build cannot disagree about the rule.
//
// Spec: https://www.conventionalcommits.org/en/v1.0.0/

export const TYPES = ["feat", "fix", "chore", "docs", "refactor", "test", "perf", "build", "ci"];

// `type(scope)!: description` — scope and `!` optional, exactly one space after
// the colon, description non-empty.
// The type is matched in any case so a capitalized one can be reported as the
// case error it is rather than as an unrecognizable subject.
const SUBJECT = /^(?<type>[A-Za-z]+)(?:\((?<scope>[^()\n]*)\))?(?<breaking>!)?: (?<description>.+)$/;

// Git writes these itself or a later command consumes them; holding them to the
// subject rule would fail commits nobody typed the subject of.
const GENERATED = [/^Merge /, /^Revert "/, /^fixup! /, /^squash! /, /^amend! /];

export function isGenerated(subject) {
  return GENERATED.some((pattern) => pattern.test(subject));
}

// The commit message as git hands it to the hook: the editor template's `#`
// lines, and everything past the `--verbose` diff marker, are not the message.
export function subjectOf(message) {
  const scissors = message.indexOf("\n# ------------------------ >8 ");
  const body = scissors === -1 ? message : message.slice(0, scissors);
  const first = body
    .split("\n")
    .find((line) => line.trim() !== "" && !line.startsWith("#"));
  return (first ?? "").trimEnd();
}

// Returns null when the subject is fine, or a one-line statement of what is
// wrong with it.
export function conventionalProblem(subject) {
  if (subject.trim() === "") return "the subject line is empty";
  const match = SUBJECT.exec(subject);
  if (!match) {
    if (/^[A-Za-z]+(\([^()]*\))?!?:\S/.test(subject)) return "no space after the colon";
    if (/^[A-Za-z]+(\([^()]*\))?!?:\s*$/.test(subject)) return "no description after the type";
    return "no `type: description` prefix";
  }
  const { type, scope, description } = match.groups;
  if (!TYPES.includes(type)) {
    const known = TYPES.find((t) => t === type.toLowerCase());
    if (known) return `type \`${type}\` must be lowercase \`${known}\``;
    return `\`${type}\` is not a type used here`;
  }
  if (scope !== undefined && scope.trim() === "") return "the scope parentheses are empty";
  if (description.startsWith(" ")) return "more than one space after the colon";
  if (description.endsWith(".")) return "the description ends with a period";
  return null;
}

export function conventionalHelp(subject) {
  return [
    `  the subject was: ${subject === "" ? "(empty)" : subject}`,
    "",
    "  The rule (Conventional Commits 1.0.0): the subject line is",
    "",
    "      type(optional-scope): description in the imperative, no trailing period",
    "",
    `  where type is one of: ${TYPES.join(", ")}`,
    "  Append `!` before the colon for a breaking change.",
    "",
    "  Correct:",
    "      fix: give sheets the focus trap their aria-modal promises",
    "      feat(memory): flag keywords the engine has stopped indexing",
    "      refactor!: drop the note-list store's legacy shape",
    "",
    "  Spec: https://www.conventionalcommits.org/en/v1.0.0/",
  ].join("\n");
}
