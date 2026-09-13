import type { Note, NoteSection } from "../api/types";
import { SECTION_CAP } from "../model/caps";
import { normalizeLine } from "../model/derived";
import { capPercent } from "../model/pressure";
import { t } from "../../../copy";

/** Cap pressure at which a section earns the flag. */
const NEAR_CAP = 0.8;

/** Past this many sections the card opens collapsed. */
const COLLAPSE_PAST = 6;

/** Stored section text as display lines.
 *
 *  @public */
export function sectionLines(text: string): string[] {
  return (text ?? "").split(/\n+/).map(normalizeLine).filter(Boolean);
}

/** @public */
export interface SectionFlag {
  sentence: string;
  ratio: number;
}

export interface SectionView {
  key: string;
  section: NoteSection;
  lines: string[];
  chars: number;
  flag: SectionFlag | null;
}

function capFlag(chars: number, key: string): SectionFlag | null {
  const ratio = chars / SECTION_CAP;
  if (ratio < NEAR_CAP) return null;
  const pct = capPercent(chars);
  return {
    ratio,
    sentence:
      ratio > 1
        ? t("memory.detail.sectionOverCap", { key, pct, cap: SECTION_CAP.toLocaleString() })
        : t("memory.detail.sectionNearCap", { key, pct, cap: SECTION_CAP.toLocaleString() }),
  };
}

/** Sections in payload order. */
export function sectionViews(note: Note): SectionView[] {
  return Object.entries(note.sections ?? {}).map(([key, section]) => {
    const text = section.text ?? "";
    return { key, section, lines: sectionLines(text), chars: text.length, flag: capFlag(text.length, key) };
  });
}

/** Source text folds by default. */
export function startsCollapsed(note: Pick<Note, "type">, sectionCount: number): boolean {
  return note.type === "source" || sectionCount > COLLAPSE_PAST;
}

/** `147 lines · 18,412 chars` — the row's size read-out. */
export function sectionMeta(view: SectionView): string {
  return t("memory.detail.sectionMeta", {
    count: view.lines.length,
    chars: view.chars.toLocaleString(),
  });
}

/** `2026-08-23 14:40` */
export function editStamp(iso: string | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** A 0–1 score as a whole percentage. */
export function percentOf(score: number): number {
  return Math.round(Math.min(1, Math.max(0, score)) * 100);
}

const SIGNED = new Intl.NumberFormat("en", { signDisplay: "exceptZero" });

/** `+12`, `-3`, `0`. */
export function signed(delta: number): string {
  return SIGNED.format(delta);
}

export interface EvidenceRef {
  kind: string;
  id: string;
}

/** An evidence entry written as `kind:id`. */
export function evidenceRef(entry: string): EvidenceRef | null {
  const m = /^([a-z][a-z0-9_]*):(\S.*)$/.exec(entry);
  return m ? { kind: m[1], id: m[2] } : null;
}

export type Scope = NonNullable<Note["scope"]>;

export interface ScopeEntry {
  field: "chatIds" | "groupIds" | "characterIds" | "personaIds";
  ids: string[];
}

/** The scope's families, each scalar merged into its array. */
export function scopeEntries(scope: Scope | undefined): ScopeEntry[] {
  if (!scope) return [];
  const family = (field: ScopeEntry["field"], scalar: string | undefined, list: string[] | undefined) => {
    const ids = [...new Set([scalar, ...(list ?? [])].filter((id): id is string => !!id))];
    return ids.length ? [{ field, ids }] : [];
  };
  return [
    ...family("chatIds", scope.chatId, scope.chatIds),
    ...family("groupIds", scope.groupId, scope.groupIds),
    ...family("characterIds", undefined, scope.characterIds),
    ...family("personaIds", scope.personaId, scope.personaIds),
  ];
}

const DIMENSION_AXES = [
  "trust",
  "respect",
  "loyalty",
  "intimacy",
  "tension",
  "hostility",
  "dependency",
  "affection",
  "lust",
  "protectiveness",
] as const;

export interface DimensionRow {
  axis: string;
  value?: number;
  delta?: number;
}

/** The ten axes in schema order, keeping those either record names. */
export function dimensionRows(
  dimensions: Record<string, number> | undefined,
  changes: Record<string, number> | undefined,
): DimensionRow[] {
  if (!dimensions && !changes) return [];
  const rows: DimensionRow[] = [];
  for (const axis of DIMENSION_AXES) {
    const value = dimensions?.[axis];
    const delta = changes?.[axis];
    if (value == null && delta == null) continue;
    rows.push({ axis, ...(value != null && { value }), ...(delta != null && { delta }) });
  }
  return rows;
}
