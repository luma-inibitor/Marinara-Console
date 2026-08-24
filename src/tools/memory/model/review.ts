// What the console makes of a review payload.
//
// A Row is the console's own unit, not the engine's: one mutation against one
// target, carrying the source it came from and the derived signals computed
// after load. The engine has no such object, which is why flattening a
// response is a transform rather than a parse.

import type { Conflict, Disposition, Mutation, NoteType, ReviewChange, ReviewResponse } from "../api/types";

// ── review rows ─────────────────────────────────────────────────────

export interface Row {
  key: string; // draftId:mutationId
  draftId: string;
  sourceNoteId: string;
  sourceTitle: string;
  targetId: string;
  targetTitle: string;
  targetType: NoteType;
  mutation: Mutation;
  disposition: Disposition;
  changes: ReviewChange[];
  conflicts: Conflict[];
  text: string;
  parts: Array<{ key: string; text: string }>;
  // derived, filled by derived.ts / pressure pass
  restates?: { score: number; line: string; noteId: string } | null;
  duplicateOf?: { key: string; score: number } | null;
  sh?: Set<string>;
}

export interface BlockedDraft {
  draftId: string;
  sourceNoteId: string;
  sourceTitle: string;
  reasons: Array<{ code: string; message: string }>;
  mutationCount: number;
}

export interface Rejection { sourceNoteId: string; sourceTitle: string; reason: string; message?: string; snippet?: string }

/** The section text a section-writing mutation carries, from whichever of the
 *  two fields holds it. Both are optional on the wire and neither is narrowed
 *  by `kind`, so a mutation may arrive with either or both; `section.text` wins
 *  because that is the field the console's own edit path writes and the field
 *  the diff renders. Undefined for kinds that write no section text —
 *  `create_note` carries a whole section map instead, which each caller reads
 *  its own way. */
export function sectionTextOf(m: Mutation): string | undefined {
  if (m.kind !== "append_section" && m.kind !== "update_section") return undefined;
  return m.section?.text ?? m.text;
}

function mutationText(m: Mutation): string {
  if (m.kind === "create_note") {
    const first = Object.values(m.note?.sections ?? {})[0];
    return first?.text ?? m.summary;
  }
  if (m.kind === "append_section" || m.kind === "update_section") return sectionTextOf(m) ?? m.summary;
  return m.summary;
}

/** [{key, text}] of section text this mutation writes, for pressure math. */
function mutationParts(m: Mutation): Array<{ key: string; text: string }> {
  if (m.kind === "create_note") {
    return Object.entries(m.note?.sections ?? {}).map(([key, s]) => ({ key, text: s.text ?? "" }));
  }
  if (m.kind === "append_section" || m.kind === "update_section") {
    return [{ key: m.sectionKey!, text: sectionTextOf(m) ?? "" }];
  }
  return [];
}

export function flattenReview(data: ReviewResponse, sourceTitles: Map<string, string>) {
  const rows: Row[] = [];
  const blocked: BlockedDraft[] = [];
  const rejections: Rejection[] = [];
  for (const source of data.sources) {
    const sourceTitle = sourceTitles.get(source.sourceNoteId) ?? source.sourceNoteId;
    const blockedDraftIds = new Set<string>();
    for (const d of source.drafts) {
      if (d.blockReasons.length) {
        blocked.push({
          draftId: d.draft.id,
          sourceNoteId: source.sourceNoteId,
          sourceTitle,
          reasons: d.blockReasons,
          mutationCount: d.draft.mutations.length,
        });
        blockedDraftIds.add(d.draft.id);
      }
      for (const r of d.candidateRejections ?? []) {
        rejections.push({ sourceNoteId: source.sourceNoteId, sourceTitle, reason: r.reason, message: r.message, snippet: r.snippet });
      }
    }
    for (const target of source.targets) {
      for (const row of target.rows) {
        if (blockedDraftIds.has(row.draftId)) continue;
        const m = row.mutation;
        rows.push({
          key: `${row.draftId}:${m.id}`,
          draftId: row.draftId,
          sourceNoteId: source.sourceNoteId,
          sourceTitle,
          targetId: target.noteId,
          targetTitle: target.title ?? target.noteId,
          targetType: target.noteType,
          mutation: m,
          disposition: row.disposition,
          changes: row.changes,
          conflicts: m.kind === "create_note" ? (m.note?.conflicts ?? []) : [],
          text: mutationText(m),
          parts: mutationParts(m),
        });
      }
    }
  }
  return { rows, blocked, rejections };
}
