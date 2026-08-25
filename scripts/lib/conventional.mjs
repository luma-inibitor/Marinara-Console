// The commit-subject rule, read from here by the hook, the CI sweep and the
// pull request title check. Spec: https://www.conventionalcommits.org/en/v1.0.0/

export const TYPES = ["feat", "fix", "chore", "docs", "refactor", "test", "perf", "build", "ci"];

// The type matches in any case so a capitalized one reports as a case error.
const SUBJECT = /^(?<type>[A-Za-z]+)(?:\((?<scope>[^()\n]*)\))?(?<breaking>!)?: (?<description>.+)$/;

const GENERATED = [/^Merge /, /^Revert "/, /^fixup! /, /^squash! /, /^amend! /];

export function isGenerated(subject) {
  return GENERATED.some((pattern) => pattern.test(subject));
}

// The editor template's `#` lines and the `--verbose` diff are not the message.
export function subjectOf(message) {
  const scissors = message.indexOf("\n# ------------------------ >8 ");
  const body = scissors === -1 ? message : message.slice(0, scissors);
  const first = body
    .split("\n")
    .find((line) => line.trim() !== "" && !line.startsWith("#"));
  return (first ?? "").trimEnd();
}

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
