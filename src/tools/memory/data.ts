// What the console makes of a review payload: rows, and the cap pressure a
// batch would create. Pure — no routes, no stores, no JSX.
//
// A Row is the console's own unit, not the engine's: one mutation against one
// target, carrying the source it came from and the derived signals computed
// after load. The engine has no such object.

import {
  SECTION_CAP,
  type Conflict, type Disposition, type Mutation, type Note, type NoteType,
  type ReviewChange, type ReviewResponse,
} from "./api/types";

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

function mutationText(m: Mutation): string {
  if (m.kind === "create_note") {
    const first = Object.values(m.note?.sections ?? {})[0];
    return first?.text ?? m.summary;
  }
  if (m.kind === "append_section" || m.kind === "update_section") return m.text ?? m.section?.text ?? m.summary;
  return m.summary;
}

/** [{key, text}] of section text this mutation writes, for pressure math. */
function mutationParts(m: Mutation): Array<{ key: string; text: string }> {
  if (m.kind === "create_note") {
    return Object.entries(m.note?.sections ?? {}).map(([key, s]) => ({ key, text: s.text ?? "" }));
  }
  if (m.kind === "append_section") return [{ key: m.sectionKey!, text: m.text ?? "" }];
  if (m.kind === "update_section") return [{ key: m.sectionKey!, text: m.section?.text ?? m.text ?? "" }];
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

// ── section pressure ────────────────────────────────────────────────
// Projected size of every additive section the queue writes to: what the note
// already holds plus what every kept-or-undecided claim would append. Mirrors
// isAdditiveLtmSection in the package's draft-projector.

function isAdditive(type: string | undefined, tags: string[] | undefined, key: string): boolean {
  const tg = tags ?? [];
  if (type === "timeline_event") return true;
  if (type === "character") return !["items", "progression"].includes(key);
  if (type === "relationship") return key === "history";
  if (type === "world") return true;
  if (type === "tone") return key === "observations";
  return tg.includes("anchor") || key === "anchors";
}

export interface SectionPressure { noteId: string; key: string; current: number; projected: number }

export function computePressure(
  rows: Row[],
  decisionOf: (key: string) => "keep" | "drop" | undefined,
  notesById: Map<string, Note>,
): Map<string, SectionPressure> {
  const proj = new Map<string, SectionPressure & { additive: boolean }>();
  for (const row of rows) {
    if (decisionOf(row.key) === "drop") continue;
    const existing = notesById.get(row.targetId);
    for (const part of row.parts) {
      const k = `${row.targetId} ${part.key}`;
      let p = proj.get(k);
      if (!p) {
        p = {
          noteId: row.targetId,
          key: part.key,
          current: existing?.sections?.[part.key]?.text?.length ?? 0,
          projected: 0,
          additive: !existing || isAdditive(existing.type ?? row.targetType, existing.tags, part.key),
        };
        p.projected = p.current;
        proj.set(k, p);
      }
      if (p.additive) p.projected += (part.text?.length ?? 0) + 2;
    }
  }
  const out = new Map<string, SectionPressure>();
  for (const [k, p] of proj) if (p.additive) out.set(k, p);
  return out;
}
