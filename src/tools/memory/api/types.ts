// The shapes the engine puts on the wire.
//
// This is the endpoints layer's vocabulary: what a payload contains, not what
// the console makes of it. Row, SectionPressure and the rest are the console's
// own inventions and live in the model, not here.
//
// Every route in api/ exists in the package's routes.ts (long-term-memory
// 1.2.9); nothing engine-side is invented. Caps and section-additivity rules
// mirror the package schema and draft-projector — fidelity beats elegance. The
// caps themselves are rules rather than payload, and live in model/caps.ts.
//
// The shapes the read paths carry — a memory, a mutation, the review queue —
// are INFERRED from the schemas in `schema.ts` that check them at runtime, so
// there is one description of each and it is the one that runs. Everything
// below `PreflightResponse` is still a hand-written interface asserted with
// `as T`, and is listed as remaining work in BACKLOG.md.

import type * as v from "valibot";
import type { ConflictSchema, MutationSchema, NoteSchema, NoteSectionSchema, NOTE_TYPES, ReviewChangeSchema, ReviewResponseSchema } from "./schema";

export type NoteType = (typeof NOTE_TYPES)[number];
export type Disposition = "new" | "merge" | "rewrite";

/** One block of a memory's body. `text` is the block; the engine's scoring
 *  fields ride through unnamed rather than being described here. */
export type NoteSection = v.InferOutput<typeof NoteSectionSchema>;

/**
 * A stored memory. Beyond the fields `schema.ts` names:
 * `keywords` is what the engine derived — not the whole recall list, and not
 * the list the 30 cap is measured against (`model/keywords.ts`).
 * `manualKeywords` is what a person typed, and is absent rather than empty on
 * notes written before the engine split the two arrays.
 * `suppressedKeywords` are derived keywords a person removed; recall skips them.
 * `provenance` says where an imported source note came from, and only source
 * notes carry it. `version` is bumped by the engine on every write.
 * `subjects` names who a memory is about — one entry on a character memory,
 * two on a relationship — as scoped identity keys, not note ids.
 */
export type Note = v.InferOutput<typeof NoteSchema>;

export type Conflict = v.InferOutput<typeof ConflictSchema>;

export type Mutation = v.InferOutput<typeof MutationSchema>;

export type ReviewChange = v.InferOutput<typeof ReviewChangeSchema>;

export type ReviewResponse = v.InferOutput<typeof ReviewResponseSchema>;

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
