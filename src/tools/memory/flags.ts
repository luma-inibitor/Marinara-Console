// One flags model for the whole tool (owner-approved redesign, 2026-08-21).
//
// A flag is a computed exception signal about a row. Rows render flags as one
// collapsed chip — flag glyph + count — tinted by the WORST severity present
// (no per-kind icons; the kinds are enumerated in the detail's computed-
// signals zone and filterable through the flags facet). Near-constant enum
// columns (disposition, risk, claim kind, confidence) have no columns of
// their own: their interesting values surface here instead (§3.2 variance
// filter — 115/124 merge, 120/124 low risk in the live corpus).
//
// A flag's `label` is a FACET VALUE as well as a chip: the quick chips in the
// review console filter on these exact strings, so they are read from the
// catalog here and nowhere else. `FLAG` is the label table, exported so a
// filter can name a flag without re-deriving its text.

import { type Note, type Row, KEYWORD_CAP, SECTION_CAP } from "./data";
import { notesById, pressure, rowOverflows } from "./store";
import { t } from "../../copy";

export const LOW_CONFIDENCE = 0.93;
const LONG_CHARS = 800;

const DATE_RE = /\[\d{4}-\d{2}-\d{2}\]/;

/** Flag labels, which are also the flags facet's values. */
export const FLAG = {
  conflicts: t("memory.flag.hasConflicts"),
  overLimit: t("memory.overLimit"),
  nearLimit: t("memory.nearLimit"),
  rewrite: t("memory.disposition.rewrite"),
  highRisk: t("memory.flag.highRisk"),
  mediumRisk: t("memory.flag.mediumRisk"),
  lowRisk: t("memory.flag.lowRisk"),
  lowConfidence: t("memory.flag.lowConfidence"),
  restates: t("memory.flag.restatesVault"),
  duplicate: t("memory.flag.duplicateIncoming"),
  long: t("memory.flag.long"),
  undated: t("memory.flag.undatedEvent"),
  noKeywords: t("memory.flag.noKeywords"),
  keywordCap: t("memory.flag.keywordCap"),
};

/** `${risk} risk` as one token, for the row's readline and the risk flags. */
export const riskLabel = (risk: string): string =>
  risk === "high" ? FLAG.highRisk : risk === "medium" ? FLAG.mediumRisk : FLAG.lowRisk;

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
      label: FLAG.conflicts, severity: "danger",
      sentence: t("memory.flag.conflictCount", { count: r.conflicts.length }),
    });
  }
  if (rowOverflows(r)) {
    f.push({ label: FLAG.overLimit, severity: "danger", sentence: overCapSentence(r, true) });
  } else if (r.parts.some((p) => (pressure.value.get(`${r.targetId} ${p.key}`)?.projected ?? 0) >= SECTION_CAP * 0.8)) {
    f.push({ label: FLAG.nearLimit, severity: "warn", sentence: overCapSentence(r, false) });
  }
  if (r.disposition === "rewrite") {
    f.push({ label: FLAG.rewrite, severity: "warn", sentence: t("reviewqueue.acceptReplacesSavedMemory") });
  }
  if (r.mutation.risk === "high") {
    f.push({ label: FLAG.highRisk, severity: "danger", sentence: t("memory.flag.highRiskSentence") });
  } else if (r.mutation.risk === "medium") {
    f.push({ label: FLAG.mediumRisk, severity: "warn", sentence: t("memory.flag.mediumRiskSentence") });
  }
  if (conf < LOW_CONFIDENCE) {
    f.push({
      label: FLAG.lowConfidence, severity: "warn",
      sentence: t("memory.flag.confidenceSentence", {
        pct: Math.round(conf * 100), threshold: Math.round(LOW_CONFIDENCE * 100),
      }),
    });
  }
  if (r.restates) {
    f.push({
      label: FLAG.restates, severity: "warn",
      sentence: t("memory.flag.restatesSentence", { score: r.restates.score.toFixed(2) }),
    });
  }
  if (r.duplicateOf) {
    f.push({
      label: FLAG.duplicate, severity: "warn",
      sentence: t("memory.flag.duplicateSentence", { score: r.duplicateOf.score.toFixed(2) }),
    });
  }
  const chars = contributionChars(r);
  if (chars >= LONG_CHARS) {
    f.push({
      label: FLAG.long, severity: "warn",
      sentence: t("memory.flag.longSentence", { chars: chars.toLocaleString() }),
    });
  }
  if (r.targetType === "timeline_event" && !DATE_RE.test(r.text)) {
    f.push({ label: FLAG.undated, severity: "warn", sentence: t("memory.flag.undatedSentence") });
  }
  if (r.mutation.kind === "create_note" && !(r.mutation.note?.keywords ?? []).length) {
    f.push({ label: FLAG.noKeywords, severity: "warn", sentence: t("memory.flag.noKeywordsSentence") });
  }
  if (((notesById.value.get(r.targetId) as Note | undefined)?.keywords ?? []).length >= 25) {
    f.push({
      label: FLAG.keywordCap, severity: "warn",
      sentence: t("memory.flag.keywordCapSentence", { cap: KEYWORD_CAP }),
    });
  }
  return f;
}

function overCapSentence(r: Row, over: boolean): string {
  let worst: { key: string; projected: number } | null = null;
  for (const p of r.parts) {
    const proj = pressure.value.get(`${r.targetId} ${p.key}`);
    if (proj && (!worst || proj.projected > worst.projected)) worst = { key: p.key, projected: proj.projected };
  }
  if (!worst) return t(over ? "memory.flag.sectionOverCap" : "memory.flag.sectionNearCap");
  const params = {
    key: worst.key,
    pct: Math.round((worst.projected / SECTION_CAP) * 100),
    cap: SECTION_CAP.toLocaleString(),
  };
  return t(over ? "memory.flag.sectionOverCapNamed" : "memory.flag.sectionNearCapNamed", params);
}

export function worstSeverity(flags: RowFlag[]): "warn" | "danger" | null {
  if (!flags.length) return null;
  return flags.some((f) => f.severity === "danger") ? "danger" : "warn";
}
