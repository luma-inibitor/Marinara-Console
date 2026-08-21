// Long-Term Memory tool: types, API layer, and engine-faithful derivations.
// Every route here exists in the package's routes.ts (long-term-memory 1.2.9);
// nothing engine-side is invented. Caps and section-additivity rules mirror
// the package schema and draft-projector — fidelity beats elegance.

import { api } from "../../shell/api";

export const SECTION_CAP = 20000; // ltmSectionSchema text max
export const KEYWORD_CAP = 30; // note keywords max

// ── wire types (subset the tool reads; extras pass through) ─────────

export type NoteType = "source" | "timeline_event" | "character" | "relationship" | "scene" | "thread" | "world" | "tone";
export type NoteStatus = "active" | "resolved" | "archived";
export type Disposition = "new" | "merge" | "rewrite";
export type Risk = "low" | "medium" | "high";

export interface NoteSection { text: string; importance?: string; [extra: string]: unknown }

export interface Note {
  id: string;
  type: NoteType;
  title?: string;
  status: NoteStatus;
  modes: string[];
  tags?: string[];
  keywords?: string[];
  links: Array<{ target: string; relation: string }>;
  sections: Record<string, NoteSection>;
  conflicts?: Conflict[];
  updatedAt?: string;
  [extra: string]: unknown;
}

export interface Conflict { field?: string; existing?: unknown; proposed?: unknown; resolution?: string; policy?: string }

export interface Mutation {
  id: string;
  kind: "create_note" | "append_section" | "update_section" | "add_link" | "set_keywords" | "set_status" | "set_subjects";
  claimKind: "static" | "change";
  risk: Risk;
  confidence: number;
  summary: string;
  evidence: string[];
  note?: Note; // create_note
  noteId?: string;
  sectionKey?: string;
  text?: string;
  section?: NoteSection; // update_section
  link?: { target: string; relation: string };
  keywords?: string[];
  status?: string;
  [extra: string]: unknown;
}

export interface ReviewChange { kind: "section" | "link" | "keywords" | "status" | "subjects"; key: string; before?: string; after: string }

export interface ReviewResponse {
  generatedAt: string;
  sources: Array<{
    sourceNoteId: string;
    modes: string[];
    drafts: Array<{
      draft: { id: string; status: string; mutations: Mutation[]; source?: { sourceNoteId?: string; chatId?: string } };
      freshness: string;
      blockReasons: Array<{ code: string; message: string }>;
      diagnostics: unknown[];
      candidateRejections: Array<{ reason: string; message?: string; snippet?: string; recovery?: { noteId?: string } }>;
    }>;
    targets: Array<{
      noteId: string;
      title?: string;
      noteType: NoteType;
      rows: Array<{ draftId: string; mutation: Mutation; disposition: Disposition; diagnostics: unknown[]; changes: ReviewChange[] }>;
    }>;
  }>;
  counts: { sources: number; drafts: number; mutations: number; blockedDrafts: number; candidateRejections: number; deduplications: number };
}

export interface PreflightResponse {
  draftId: string;
  selectedMutationIds: string[];
  readyMutationIds: string[];
  blockedMutationIds: string[];
  autoIncludedMutationIds: string[];
  rows: Array<{ mutationId: string; targetId: string; disposition: Disposition; status: "ready" | "blocked"; autoIncluded: boolean; blockers: Array<{ code: string; message: string }>; conflicts: Conflict[] }>;
}

export interface AcceptResponse {
  draft: { id: string; status: string; indexRebuildStatus?: string; indexRebuildError?: string };
  appliedMutationIds?: string[];
  skippedMutationIds?: string[];
  autoIncludedMutationIds?: string[];
}

export interface LtmStatus {
  notes: { total: number; sourceNotes: number; savedMemories: number; pendingDrafts: number; byType: Record<string, number>; byStatus: Record<string, number> };
  indexes: { health: string; dirty: boolean; rebuildState: string; embeddingsAvailable: boolean };
}

export interface ImportPreview {
  source: string;
  scanned: number;
  draftable: number;
  importedCount: number;
  samples: Array<{ sourceId: string; title: string; importMode: string; mutationCount: number; summary: string; snippet: string; status?: string; freshness: string }>;
}

export interface ImportResult {
  batchStatus: string;
  source: string;
  imported: Array<{
    sourceId: string;
    title: string;
    note?: Note;
    draft?: {
      mutations?: Mutation[];
      source?: { sourceNoteId?: string };
      accounting?: { providerCandidates: number; normalizedAdditions: number; parserRejections: number; validationRejections: number; deduplications: number; keptUnits: number };
      extractionOutcome?: { state: string };
    };
  }>;
}

// ── API ─────────────────────────────────────────────────────────────

const LTM = "/long-term-memory";

export const ltmStatus = () => api<LtmStatus>(`${LTM}/status`);
export const fetchReview = () => api<ReviewResponse>(`${LTM}/drafts/review`);
export const fetchNotes = (query: Record<string, string | number> = {}) => {
  const qs = new URLSearchParams(Object.entries(query).map(([k, v]) => [k, String(v)])).toString();
  return api<Note[]>(`${LTM}/notes${qs ? `?${qs}` : ""}`);
};
export const fetchNote = (id: string) => api<Note>(`${LTM}/notes/${id}`);
export const patchNote = (id: string, patch: Record<string, unknown>) =>
  api<Note>(`${LTM}/notes/${id}`, { method: "PATCH", body: patch });
export const deleteNote = (id: string) => api(`${LTM}/notes/${id}`, { method: "DELETE" });
export const extractNote = (id: string, body: Record<string, unknown> = {}) =>
  api(`${LTM}/notes/${id}/extract`, { method: "POST", body });
export const preflightDraft = (draftId: string, body: { mutationIds: string[]; editedMutations?: Mutation[] }) =>
  api<PreflightResponse>(`${LTM}/drafts/${draftId}/preflight`, { method: "POST", body });
export const acceptDraft = (draftId: string, body: { mutationIds: string[]; editedMutations?: Mutation[] }) =>
  api<AcceptResponse>(`${LTM}/drafts/${draftId}/accept`, { method: "POST", body });
export const skipMutations = (draftId: string, mutationIds: string[]) =>
  api<{ deleted: boolean; mutationIds?: string[] }>(`${LTM}/drafts/${draftId}/skip`, { method: "POST", body: { mutationIds } });
export const importPreview = (source: string) =>
  api<ImportPreview>(`${LTM}/import/preview`, { method: "POST", body: { source } });
export const importSourceNotes = (body: Record<string, unknown>) =>
  api<ImportResult>(`${LTM}/import/source-notes`, { method: "POST", body });
export const rebuildIndexes = () => api(`${LTM}/rebuild`, { method: "POST", body: {} });
export const backupExportUrl = () => `/api${LTM}/backup/export`;

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

export function mutationText(m: Mutation): string {
  if (m.kind === "create_note") {
    const first = Object.values(m.note?.sections ?? {})[0];
    return first?.text ?? m.summary;
  }
  if (m.kind === "append_section" || m.kind === "update_section") return m.text ?? m.section?.text ?? m.summary;
  return m.summary;
}

/** [{key, text}] of section text this mutation writes, for pressure math. */
export function mutationParts(m: Mutation): Array<{ key: string; text: string }> {
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

export function isAdditive(type: string | undefined, tags: string[] | undefined, key: string): boolean {
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
