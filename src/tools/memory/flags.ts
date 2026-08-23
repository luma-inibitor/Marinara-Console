// One flags model for the whole tool (owner-approved redesign, 2026-08-21).
//
// A flag is a computed exception signal about a row. Rows render flags as one
// collapsed chip — flag glyph + count — tinted by the WORST severity present
// (no per-kind icons; the kinds are enumerated in the detail's computed-
// signals zone and filterable through the flags facet). Near-constant enum
// columns (disposition, risk, claim kind, confidence) have no columns of
// their own: their interesting values surface here instead (§3.2 variance
// filter — 115/124 merge, 120/124 low risk in the live corpus).

import { type Note, type Row, SECTION_CAP } from "./data";
import { notesById, pressure, rowOverflows } from "./store";
import { t, OURS } from "./strings";

export const LOW_CONFIDENCE = 0.93;
const LONG_CHARS = 800;

const DATE_RE = /\[\d{4}-\d{2}-\d{2}\]/;

export interface RowFlag {
  /** Facet value — stable, filterable, shown in the detail signals zone. */
  label: string;
  severity: "warn" | "danger";
  /** Full sentence for the detail's computed-signals zone. */
  sentence: string;
}

/** The mutation's own contribution in characters (a fact about the mutation,
 *  unlike section pressure, which is computed against the vault + batch). */
export function contributionChars(r: Row): number {
  const m = r.mutation;
  if (m.kind === "append_section" || m.kind === "update_section") {
    return (m.text ?? m.section?.text ?? "").length;
  }
  if (m.kind === "create_note") {
    return Object.values(m.note?.sections ?? {}).reduce((n, s) => n + (s?.text ?? "").length, 0);
  }
  return 0;
}

export function flagsOf(r: Row): RowFlag[] {
  const f: RowFlag[] = [];
  const conf = r.mutation.confidence;

  if (r.conflicts.length) {
    f.push({
      label: "has conflicts", severity: "danger",
      sentence: `${r.conflicts.length} field conflict${r.conflicts.length === 1 ? "" : "s"} with the stored memory`,
    });
  }
  if (rowOverflows(r)) {
    f.push({ label: OURS.overLimit, severity: "danger", sentence: overCapSentence(r, true) });
  } else if (r.parts.some((p) => (pressure.value.get(`${r.targetId} ${p.key}`)?.projected ?? 0) >= SECTION_CAP * 0.8)) {
    f.push({ label: OURS.nearLimit, severity: "warn", sentence: overCapSentence(r, false) });
  }
  if (r.disposition === "rewrite") {
    f.push({ label: "rewrite", severity: "warn", sentence: t("reviewqueue.acceptReplacesSavedMemory") });
  }
  if (r.mutation.risk === "high") {
    f.push({ label: "high risk", severity: "danger", sentence: "the extractor rates this claim high risk" });
  } else if (r.mutation.risk === "medium") {
    f.push({ label: "medium risk", severity: "warn", sentence: "the extractor rates this claim medium risk" });
  }
  if (conf < LOW_CONFIDENCE) {
    f.push({
      label: "low confidence", severity: "warn",
      sentence: `${Math.round(conf * 100)}% — below the ${Math.round(LOW_CONFIDENCE * 100)}% confidence threshold`,
    });
  }
  if (r.restates) {
    f.push({
      label: "restates vault", severity: "warn",
      sentence: `very similar (${r.restates.score.toFixed(2)}) to a line already stored`,
    });
  }
  if (r.duplicateOf) {
    f.push({
      label: "duplicate incoming", severity: "warn",
      sentence: `very similar (${r.duplicateOf.score.toFixed(2)}) to another incoming claim in this batch`,
    });
  }
  const chars = contributionChars(r);
  if (chars >= LONG_CHARS) {
    f.push({
      label: "long", severity: "warn",
      sentence: `long entry: +${chars.toLocaleString()} chars in one claim`,
    });
  }
  if (r.targetType === "timeline_event" && !DATE_RE.test(r.text)) {
    f.push({ label: "undated event", severity: "warn", sentence: "a timeline event with no [YYYY-MM-DD] date in its text" });
  }
  if (r.mutation.kind === "create_note" && !(r.mutation.note?.keywords ?? []).length) {
    f.push({ label: "no keywords", severity: "warn", sentence: "a new memory with no keywords — keyword matching cannot find it" });
  }
  if (((notesById.value.get(r.targetId) as Note | undefined)?.keywords ?? []).length >= 25) {
    f.push({ label: "target near keyword cap", severity: "warn", sentence: "the target memory is near its 30-keyword cap" });
  }
  return f;
}

function overCapSentence(r: Row, over: boolean): string {
  let worst: { key: string; projected: number } | null = null;
  for (const p of r.parts) {
    const proj = pressure.value.get(`${r.targetId} ${p.key}`);
    if (proj && (!worst || proj.projected > worst.projected)) worst = { key: p.key, projected: proj.projected };
  }
  if (!worst) return over ? "the section would exceed its cap after this batch" : "the section is close to its cap";
  const pct = Math.round((worst.projected / SECTION_CAP) * 100);
  return over
    ? `§${worst.key} would reach ${pct}% of its ${SECTION_CAP.toLocaleString()}-char cap after this batch — over the limit`
    : `§${worst.key} is at ${pct}% of its ${SECTION_CAP.toLocaleString()}-char cap after this batch`;
}

export function worstSeverity(flags: RowFlag[]): "warn" | "danger" | null {
  if (!flags.length) return null;
  return flags.some((f) => f.severity === "danger") ? "danger" : "warn";
}
