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


export type NoteType = "source" | "timeline_event" | "character" | "relationship" | "scene" | "thread" | "world" | "tone";
type NoteStatus = "active" | "resolved" | "archived";
export type Disposition = "new" | "merge" | "rewrite";
type Risk = "low" | "medium" | "high";

export interface NoteSection { text: string; importance?: string; [extra: string]: unknown }

export interface Note {
  id: string;
  type: NoteType;
  title?: string;
  status: NoteStatus;
  modes: string[];
  tags?: string[];
  /** What the engine derived. Not the whole recall list, and not the list the
   *  30 cap is measured against — see `model/keywords.ts`. */
  keywords?: string[];
  /** What a person typed. Absent on notes written before the engine split the
   *  arrays, which is why its absence has to be distinguished from empty. */
  manualKeywords?: string[];
  /** Derived keywords a person removed; recall skips them. */
  suppressedKeywords?: string[];
  /** Where an imported source note came from. `kind` is the engine's singular
   *  source-kind name — `lorebook`, `character`, `chat_summary`. Only source
   *  notes carry it. */
  provenance?: { kind?: string; sourceId?: string };
  links: Array<{ target: string; relation: string }>;
  sections: Record<string, NoteSection>;
  conflicts?: Conflict[];
  updatedAt?: string;
  /** Bumped by the engine on every write; the detail card's meta line shows it. */
  version?: number;
  /** Note ids this memory is about. Always names the note itself on a character
   *  memory, where it carries nothing; on a relationship it names both people. */
  subjects?: string[];
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
