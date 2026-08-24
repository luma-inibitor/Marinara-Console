// The memory detail card's data model — pure, no JSX, no stores.
//
// Every section behaves the same way: one row, one chevron, expands in place.
// There is no size threshold here and no second surface to route long sections
// to, so nothing has to predict how tall a body will render. A long section is
// handled by its row sticking to the top of the screen while you read it, which
// is a CSS behavior rather than a decision this module makes.

import { type Note, SECTION_CAP } from "../api/types";
import { normalizeLine } from "../derived";
import { t } from "../../../copy";

/** Cap pressure at which a section earns the flag. */
const NEAR_CAP = 0.8;

/** Stored section text as display lines: blank lines are separators rather
 *  than content, and a leading bullet marker is punctuation the row re-adds.
 *  Shares `normalizeLine` with the vault reader so the two cannot drift — they
 *  did, and an indented sub-bullet used to render behind two markers. */
export function sectionLines(text: string): string[] {
  return (text ?? "").split(/\n+/).map(normalizeLine).filter(Boolean);
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
    return { key, lines: sectionLines(text), chars: text.length, flag: capFlag(text.length, key) };
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
 *  as English instead of as a wire value. An unrecognized relation humanizes
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
