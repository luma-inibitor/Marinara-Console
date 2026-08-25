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
// The types down to ReviewResponse are inferred from the schemas in schema.ts
// that check them; everything below is still asserted with `as T`.

import type * as v from "valibot";
import type { ConflictSchema, MutationSchema, NoteSchema, NoteSectionSchema, NOTE_TYPES, ReviewChangeSchema, ReviewResponseSchema } from "./schema";

export type NoteType = (typeof NOTE_TYPES)[number];
export type Disposition = "new" | "merge" | "rewrite";

export type NoteSection = v.InferOutput<typeof NoteSectionSchema>;

/** `keywords` is what the engine derived, and is not the list the 30 cap is
 *  measured against; see model/keywords.ts. `manualKeywords` is absent, not
 *  empty, on notes written before the engine split the two arrays. */
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
