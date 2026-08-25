// Checks an engine response against a schema before the app believes it.
//
// The failure contract when reading: a bad envelope throws and the screen
// falls back to its existing error state, a bad element of a list is dropped
// and the rest are returned, and unknown fields are not a mismatch at all.
// Neither failure is silent: both log the issues and raise a toast.
//
// Writing is all or nothing — see parseWrite.
import * as v from "valibot";
import { t } from "../copy";

export class WireMismatchError extends Error {
  issues: string[];
  context: string;
  constructor(context: string, issues: string[], message?: string) {
    super(message ?? `${context}: ${issues.join("; ")}`);
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

/** Lazy: a static import of the toast queue puts this module in a cycle. */
function announce(message: string) {
  void import("./toast").then(({ toast }) => toast(message, { kind: "error" }));
}

function report(context: string, issues: string[], message: string) {
  console.error(`[wire] ${context}`, issues);
  announce(message);
}

export function parseWire<S extends Schema>(schema: S, value: unknown, context: string): v.InferOutput<S> {
  const result = v.safeParse(schema, value);
  if (result.success) return result.output;
  const issues = describe(result.issues);
  report(context, issues, t("shell.wire.mismatch", { context }));
  throw new WireMismatchError(context, issues);
}

/** A write parses whole or not at all. Dropping a bad element the way a read
 *  does would leave the vault showing a memory the engine has already changed,
 *  after telling the person their edit went through — so a mismatch here throws
 *  instead, carrying copy that says the change did land and the view did not.
 *
 *  No toast: every caller of a write already reports what it catches, and the
 *  read paths' announce would make that two. */
export function parseWrite<S extends Schema>(schema: S, value: unknown, context: string): v.InferOutput<S> {
  const result = v.safeParse(schema, value);
  if (result.success) return result.output;
  const issues = describe(result.issues);
  console.error(`[wire] ${context}`, issues);
  throw new WireMismatchError(context, issues, t("shell.wire.writeMismatch", { context }));
}

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
