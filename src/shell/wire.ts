// Parse the wire, don't assert it.
//
// `api()` ends in `as T`, which is a promise the compiler makes and nothing
// checks. The engine is a separately released project, so a shape change
// reaches this console as data, not as a type error — and it has: booleans
// arrived as the strings "true"/"false", and an unwrapped write envelope keyed
// a note under `undefined`. This module is where a response stops being
// `unknown` and starts being a shape someone verified.
//
// Two failure modes, chosen for what a person can still do afterwards:
//
//   parseWire   — the envelope. If the outer shape is wrong there is nothing
//                 to render, so it throws and the screen shows the error state
//                 it already has for a failed request.
//   parseItems  — one element of a collection. Thirty good memories should not
//                 vanish because the thirty-first is malformed, so the bad one
//                 is dropped and the rest are returned.
//
// Neither is ever silent: both write the issues to the console and raise a
// toast, so a mismatch is visible to whoever is running the app rather than
// waiting to surface as a crash somewhere unrelated.
//
// Unknown fields are NOT a mismatch. Every schema built on this is a
// `looseObject`, so a field the engine added passes through untouched. The
// schemas describe what the console depends on, not everything the engine
// sends; that is what keeps a routine engine release from emptying a screen.
import * as v from "valibot";
import { t } from "../copy";

/** A response that did not match its schema, carrying the per-field issues. */
export class WireMismatchError extends Error {
  /** One `path: message` line per issue, in the order valibot reported them. */
  issues: string[];
  /** The route the response came from, as the caller named it. */
  context: string;
  constructor(context: string, issues: string[]) {
    super(`${context}: ${issues.join("; ")}`);
    this.name = "WireMismatchError";
    this.context = context;
    this.issues = issues;
  }
}

type Schema = v.BaseSchema<unknown, unknown, v.BaseIssue<unknown>>;

const describe = (issues: readonly v.BaseIssue<unknown>[]): string[] =>
  issues.map((issue) => {
    const path = v.getDotPath(issue);
    return path ? `${path}: ${issue.message}` : issue.message;
  });

/** Lazy, so this module stays importable from anywhere the toast queue is not
 *  — the same reason api.ts reaches for it this way. */
function announce(message: string) {
  void import("./toast").then(({ toast }) => toast(message, { kind: "error" }));
}

function report(context: string, issues: string[], message: string) {
  console.error(`[wire] ${context}`, issues);
  announce(message);
}

/**
 * Check a whole response. Returns the parsed value, or throws
 * `WireMismatchError` — which reaches a caller as any other failed request
 * does, because a response the console cannot read is a request that failed.
 */
export function parseWire<S extends Schema>(schema: S, value: unknown, context: string): v.InferOutput<S> {
  const result = v.safeParse(schema, value);
  if (result.success) return result.output;
  const issues = describe(result.issues);
  report(context, issues, t("shell.wire.mismatch", { context }));
  throw new WireMismatchError(context, issues);
}

/**
 * Check every element of a list, keeping the ones that match. A response that
 * is not a list at all is an envelope failure and throws; a bad element is
 * dropped and reported with the count, so the screen still renders and the
 * loss is stated rather than inferred from a short list.
 */
export function parseItems<S extends Schema>(schema: S, value: unknown, context: string): v.InferOutput<S>[] {
  if (!Array.isArray(value)) {
    const issues = [t("shell.wire.notAList")];
    report(context, issues, t("shell.wire.mismatch", { context }));
    throw new WireMismatchError(context, issues);
  }
  const kept: v.InferOutput<S>[] = [];
  const issues: string[] = [];
  value.forEach((item, index) => {
    const result = v.safeParse(schema, item);
    if (result.success) kept.push(result.output);
    else issues.push(...describe(result.issues).map((line) => `[${index}] ${line}`));
  });
  const dropped = value.length - kept.length;
  if (dropped > 0) report(context, issues, t("shell.wire.dropped", { count: dropped, context }));
  return kept;
}
