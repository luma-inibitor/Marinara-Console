// The memory detail card's data model — pure, no JSX, no stores.
//
// Its whole job is to answer one question per section: does the body fit the
// preview budget? The row's glyph and the row's tap behaviour both read that
// single answer, so the glyph cannot promise an inline expand and then open a
// peek — the rule the handoff states the row must never break.
//
// Fit is ESTIMATED, not measured. A DOM measurement can only run after first
// paint, so the glyph would render as a chevron and then become an arrow: the
// exact drift the rule forbids, arriving as a flicker. The estimate is
// deterministic and available before the first render.

import { SECTION_CAP, type Note } from "../data";
import { t } from "../../../copy";

/** Preview height, matching the fade overlay's clip. */
export const PREVIEW_BUDGET = 168;

/** Body type: 13.5px at 1.5, one row per line, 7px between rows. */
const LINE_HEIGHT = 20.25;
const LINE_GAP = 7;

/** `--measure: 68ch`. The body is capped at the reading measure, so a line
 *  wraps about every 68 characters — close enough to predict a row count. */
const COLS = 68;

/** Cap pressure at which a section earns the flag. */
const NEAR_CAP = 0.8;

/** Stored section text as display lines: blank lines are separators rather
 *  than content, and a leading bullet marker is punctuation the row re-adds.
 *  The same normalisation `derived.ts` uses to read the vault line by line. */
export function sectionLines(text: string): string[] {
  return (text ?? "")
    .split(/\n+/)
    .map((line) => line.replace(/^[-•*]\s*/, "").trim())
    .filter(Boolean);
}

/** Rendered height of a body, in px, without rendering it. */
function estimateHeight(lines: string[]): number {
  if (!lines.length) return 0;
  const rows = lines.reduce((sum, line) => sum + Math.max(1, Math.ceil(line.length / COLS)), 0);
  return rows * LINE_HEIGHT + (lines.length - 1) * LINE_GAP;
}

export interface SectionFlag {
  /** Sentence shown in the row's flag popover. */
  sentence: string;
  /** How full the section is against its cap, 0–1+. */
  ratio: number;
}

export interface SectionView {
  key: string;
  lines: string[];
  chars: number;
  /** True when the body fits the preview budget: chevron, expands in place.
   *  False: diagonal arrow, opens the peek. Nothing else may decide this. */
  fits: boolean;
  flag: SectionFlag | null;
}

/** A section's cap flag. `--flag` is reserved for computed outliers, and cap
 *  pressure is the only one a STORED section can carry — every other rule in
 *  `flags.ts` is about a proposed row in the review queue. */
function capFlag(chars: number, key: string): SectionFlag | null {
  const ratio = chars / SECTION_CAP;
  if (ratio < NEAR_CAP) return null;
  const pct = Math.round(ratio * 100);
  return {
    ratio,
    sentence: ratio >= 1
      ? t("memory.detail.sectionOverCap", { key, pct, cap: SECTION_CAP.toLocaleString() })
      : t("memory.detail.sectionNearCap", { key, pct, cap: SECTION_CAP.toLocaleString() }),
  };
}

/** Sections in PAYLOAD ORDER. Keys are arbitrary suggestions rather than an
 *  enum, so there is no `core`-first rule to apply; sorting them would invent
 *  a hierarchy the data does not have. */
export function sectionViews(note: Note): SectionView[] {
  return Object.entries(note.sections ?? {}).map(([key, section]) => {
    const text = section.text ?? "";
    const lines = sectionLines(text);
    return {
      key,
      lines,
      chars: text.length,
      fits: estimateHeight(lines) <= PREVIEW_BUDGET,
      flag: capFlag(text.length, key),
    };
  });
}

/** `147 lines · 18,412 chars` — the row's size read-out. */
export function sectionMeta(view: SectionView): string {
  return t("memory.detail.sectionMeta", {
    count: view.lines.length,
    chars: view.chars.toLocaleString(),
  });
}

/** Catalog labels for every link relation the product names, so a link reads
 *  as English instead of as a wire value. An unrecognised relation humanises
 *  rather than falling through to `snake_case`: the target's title is the
 *  point of the row and the relation is only its preposition. */
const RELATION_KEY = {
  extracted_from: "memoryvault.relationExtractedFrom",
  occurred_in: "memoryvault.relationOccurredIn",
  triggered_by: "memoryvault.relationTriggeredBy",
  resolved_in: "memoryvault.relationResolvedIn",
  evidenced_by: "memoryvault.relationEvidencedBy",
  affects_relationship: "memoryvault.relationAffectsRelationship",
  affects_character: "memoryvault.relationAffectsCharacter",
  caused_by: "memoryvault.relationCausedBy",
  involves: "memoryvault.relationInvolves",
  blocks: "memoryvault.relationBlocks",
  planted_in: "memoryvault.relationPlantedIn",
  paid_off_in: "memoryvault.relationPaidOffIn",
  related_to: "memory.detail.relationRelatedTo",
} as const;

export function relationLabel(relation: string): string {
  const key = RELATION_KEY[relation as keyof typeof RELATION_KEY];
  if (key) return t(key);
  const words = relation.replaceAll("_", " ");
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/** `2026-08-23 14:40` — the meta line's edit stamp. Space-separated rather
 *  than ISO-T and without seconds: a person reading when, not a key. */
export function editStamp(iso: string | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
