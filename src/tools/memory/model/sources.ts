// One model per importable source, assembled from three places the engine
// already exposes (approved specimens: public/mockups/sources-v1.html).
//
//   import/preview   → the candidate, its freshness, and the note it became
//   drafts/review    → claims still waiting, and why a draft is blocked
//   notes            → the memories that exist because of it
//
// State names are the product catalog's, never coined (design/CHECKLIST.md §2).

import type { ImportPreview, Note, ReviewResponse } from "../api/types";

export type SourceKind = "characters" | "lorebooks" | "chats";

/** Catalog freshness values, mapped to the six states the UI draws. */
export type SourceState =
  | "new"
  | "current"
  | "source_updated"
  | "context_updated"
  | "extraction_incomplete"
  | "source_missing";

export interface SourceRow {
  kind: SourceKind;
  sourceId: string;
  title: string;
  /** What this row is listed under. A lorebook's entries group by the book,
   *  which is what the live corpus demanded: 90 of 100 parts shared one book
   *  name, so every row spent its width repeating it and truncated away the
   *  entry that told them apart. */
  group: string;
  importMode: string;
  state: SourceState;
  /** The source note this became, when it has been imported. */
  noteId?: string;
  snippet: string;
  /** Memories in the vault created from this source. */
  derived: Array<{ id: string; title: string; type: string }>;
  /** Claims from this source still waiting in the review queue. */
  pending: number;
  /** Drafts held before review, with the reason code. */
  blocked: string[];
}

export function isImported(r: SourceRow): boolean {
  return r.state !== "new";
}

/** Only a source that can produce something new is worth selecting. */
export function isSelectable(r: SourceRow): boolean {
  return r.state !== "current" && r.state !== "source_missing";
}

export function buildSources(
  previews: Map<SourceKind, ImportPreview>,
  review: ReviewResponse | null,
  notes: Note[],
): SourceRow[] {
  // memories, indexed by the source note they were extracted from
  const derivedBySource = new Map<string, Array<{ id: string; title: string; type: string }>>();
  for (const n of notes) {
    for (const l of n.links ?? []) {
      if (l.relation !== "extracted_from") continue;
      const list = derivedBySource.get(l.target) ?? [];
      list.push({ id: n.id, title: n.title ?? n.id, type: n.type });
      derivedBySource.set(l.target, list);
    }
  }

  // pending claims and block reasons, indexed by source note
  const pendingBySource = new Map<string, number>();
  const blockedBySource = new Map<string, string[]>();
  for (const s of review?.sources ?? []) {
    const codes: string[] = [];
    // A held draft's rows never reach the queue (flattenReview drops them), so
    // counting them here would advertise work that opening the queue does not
    // show. Both passes suppress on the same set, scoped to this source.
    const held = new Set<string>();
    for (const d of s.drafts) {
      if (d.blockReasons.length) held.add(d.draft.id);
      for (const b of d.blockReasons) codes.push(b.code);
    }
    let n = 0;
    for (const t of s.targets) for (const r of t.rows) if (!held.has(r.draftId)) n += 1;
    pendingBySource.set(s.sourceNoteId, n);
    if (codes.length) blockedBySource.set(s.sourceNoteId, codes);
  }

  const out: SourceRow[] = [];
  for (const [kind, preview] of previews) {
    for (const s of preview.samples) {
      const noteId = (s as { existingNoteId?: string }).existingNoteId;
      const blocked = noteId ? blockedBySource.get(noteId) ?? [] : [];
      out.push({
        kind,
        sourceId: s.sourceId,
        title: entryTitle(s.title, kind),
        group: groupOf(s.title, kind),
        importMode: s.importMode,
        state: resolveState(s.freshness, blocked),
        noteId,
        snippet: s.snippet ?? "",
        derived: noteId ? derivedBySource.get(noteId) ?? [] : [],
        pending: noteId ? pendingBySource.get(noteId) ?? 0 : 0,
        blocked,
      });
    }
  }
  return out;
}

/** The engine titles a lorebook part "Lorebook - <book>: <entry>". The kind
 *  icon and the group header carry the first two parts, so the row shows the
 *  entry alone. */
function stripKind(title: string, kind: SourceKind): string {
  const prefix = kind === "lorebooks" ? "Lorebook - " : kind === "characters" ? "Character - " : "";
  return prefix && title.startsWith(prefix) ? title.slice(prefix.length) : title;
}
function groupOf(title: string, kind: SourceKind): string {
  if (kind !== "lorebooks") return "";
  const t = stripKind(title, kind);
  const i = t.indexOf(":");
  return i > 0 ? t.slice(0, i).trim() : t;
}
function entryTitle(title: string, kind: SourceKind): string {
  const t = stripKind(title, kind);
  if (kind !== "lorebooks") return t;
  const i = t.indexOf(":");
  return i > 0 ? t.slice(i + 1).trim() : t;
}

function resolveState(freshness: string, blocked: string[]): SourceState {
  // A held draft describes the source more usefully than its freshness does.
  if (blocked.includes("source_missing")) return "source_missing";
  if (blocked.includes("source_stale")) return "context_updated";
  switch (freshness) {
    case "current": return "current";
    case "source_updated": return "source_updated";
    case "context_updated": return "context_updated";
    case "extraction_incomplete": return "extraction_incomplete";
    default: return "new";
  }
}

/** Rail partition: every source falls in exactly one of these. */
export function partition(rows: SourceRow[]) {
  const pending = rows.filter((r) => !isImported(r));
  const imported = rows.filter((r) => isImported(r));
  return { pending, imported, all: rows };
}
