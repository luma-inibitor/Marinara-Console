// Validates every long-term-memory route the console calls; `types.ts` infers
// its types from here.
//
// Every object is loose, so the fields the engine sends and the console never
// reads pass through unnamed. A field is required below only where the console
// cannot work without it, since required is what drops a record.
import * as v from "valibot";

// Closed sets rather than `v.string()`: the copy catalog holds one label per
// member and no fallback, so an unknown member has nothing to render as.
export const NOTE_TYPES = ["source", "timeline_event", "character", "relationship", "scene", "thread", "world", "tone"] as const;
const NOTE_STATUSES = ["active", "resolved", "archived"] as const;
export const DISPOSITIONS = ["new", "merge", "rewrite"] as const;
const RISKS = ["low", "medium", "high"] as const;
const MUTATION_KINDS = ["create_note", "append_section", "update_section", "add_link", "set_keywords", "set_status", "set_subjects"] as const;
const CHANGE_KINDS = ["section", "link", "keywords", "status", "subjects"] as const;

/** Non-empty: a memory with a blank id keys the notes map under `undefined`. */
const id = v.pipe(v.string(), v.minLength(1));
const strings = v.array(v.string());

export const NoteSectionSchema = v.looseObject({
  text: v.string(),
  importance: v.optional(v.string()),
});

/** Not `string[]`, whatever `types.ts` used to say: the engine sends a scoped
 *  identity key ("character:sPXZ…", "npc:watson"), and `ref` only when that key
 *  resolves to a host record. */
const SubjectSchema = v.looseObject({
  key: v.string(),
  ref: v.optional(v.looseObject({ kind: v.optional(v.string()), id: v.optional(v.string()) })),
});

const LinkSchema = v.looseObject({
  target: v.string(),
  relation: v.string(),
});

export const ConflictSchema = v.looseObject({
  field: v.optional(v.string()),
  existing: v.optional(v.unknown()),
  proposed: v.optional(v.unknown()),
  resolution: v.optional(v.string()),
  policy: v.optional(v.string()),
});

export const NoteSchema = v.looseObject({
  id,
  type: v.picklist(NOTE_TYPES),
  title: v.optional(v.string()),
  status: v.picklist(NOTE_STATUSES),
  modes: strings,
  tags: v.optional(strings),
  keywords: v.optional(strings),
  manualKeywords: v.optional(strings),
  suppressedKeywords: v.optional(strings),
  provenance: v.optional(v.looseObject({ kind: v.optional(v.string()), sourceId: v.optional(v.string()) })),
  links: v.array(LinkSchema),
  sections: v.record(v.string(), NoteSectionSchema),
  conflicts: v.optional(v.array(ConflictSchema)),
  updatedAt: v.optional(v.string()),
  version: v.optional(v.number()),
  subjects: v.optional(v.array(SubjectSchema)),
});

export const MutationSchema = v.looseObject({
  id,
  kind: v.picklist(MUTATION_KINDS),
  claimKind: v.picklist(["static", "change"]),
  risk: v.picklist(RISKS),
  confidence: v.number(),
  summary: v.string(),
  evidence: strings,
  note: v.optional(NoteSchema),
  noteId: v.optional(v.string()),
  sectionKey: v.optional(v.string()),
  text: v.optional(v.string()),
  section: v.optional(NoteSectionSchema),
  link: v.optional(LinkSchema),
  keywords: v.optional(strings),
  status: v.optional(v.string()),
});

export const ReviewChangeSchema = v.looseObject({
  kind: v.picklist(CHANGE_KINDS),
  key: v.string(),
  before: v.optional(v.string()),
  after: v.string(),
});

const DraftSchema = v.looseObject({
  id,
  status: v.string(),
  mutations: v.array(MutationSchema),
  source: v.optional(v.looseObject({ sourceNoteId: v.optional(v.string()), chatId: v.optional(v.string()) })),
});

const DraftEntrySchema = v.looseObject({
  draft: DraftSchema,
  freshness: v.string(),
  blockReasons: v.array(v.looseObject({ code: v.string(), message: v.string() })),
  diagnostics: v.array(v.unknown()),
  candidateRejections: v.array(v.looseObject({
    reason: v.string(),
    message: v.optional(v.string()),
    snippet: v.optional(v.string()),
    recovery: v.optional(v.looseObject({ noteId: v.optional(v.string()) })),
  })),
});

const TargetSchema = v.looseObject({
  noteId: v.string(),
  title: v.optional(v.string()),
  noteType: v.picklist(NOTE_TYPES),
  rows: v.array(v.looseObject({
    draftId: v.string(),
    mutation: MutationSchema,
    disposition: v.picklist(DISPOSITIONS),
    diagnostics: v.array(v.unknown()),
    changes: v.array(ReviewChangeSchema),
  })),
});

export const ReviewResponseSchema = v.looseObject({
  generatedAt: v.string(),
  sources: v.array(v.looseObject({
    sourceNoteId: v.string(),
    modes: strings,
    drafts: v.array(DraftEntrySchema),
    targets: v.array(TargetSchema),
  })),
  counts: v.looseObject({
    sources: v.number(),
    drafts: v.number(),
    mutations: v.number(),
    blockedDrafts: v.number(),
    candidateRejections: v.number(),
    deduplications: v.number(),
  }),
});

/** PATCH wraps the saved memory beside the index rebuild it kicked off, never
 *  a bare note. `rebuild` is unnamed here because nothing reads it. */
export const NoteWriteSchema = v.looseObject({
  note: NoteSchema,
});

/** DELETE archives the memory together with everything extracted from it.
 *  `notes` leads with the target, so the target is in the array as well as in
 *  `note`, and a caller counting the cascade has to subtract it. */
export const NoteArchiveSchema = v.looseObject({
  archived: v.boolean(),
  note: NoteSchema,
  notes: v.array(NoteSchema),
});

/** Extraction answers with the draft it produced and never with a note: the
 *  vault is untouched until the review queue accepts. Nothing here is read, so
 *  `operationId` is required only to prove the reply is an extraction result —
 *  which is the check that would have caught this route being typed as a note
 *  write for as long as it was. */
export const ExtractResponseSchema = v.looseObject({
  operationId: v.string(),
  draft: v.nullish(DraftSchema),
});

/** Open sets: the banner compares these two rather than labelling them. */
export const LtmStatusSchema = v.looseObject({
  notes: v.looseObject({
    total: v.number(),
    sourceNotes: v.number(),
    savedMemories: v.number(),
    pendingDrafts: v.number(),
    byType: v.record(v.string(), v.number()),
    byStatus: v.record(v.string(), v.number()),
  }),
  indexes: v.looseObject({
    health: v.string(),
    dirty: v.boolean(),
    rebuildState: v.string(),
    embeddingsAvailable: v.boolean(),
  }),
});

/** Two shapes upstream, split on `status`. An imported sample names the source
 *  note it became; a pending one has no note yet. */
const ImportSampleSchema = v.looseObject({
  sourceId: v.string(),
  title: v.string(),
  importMode: v.string(),
  mutationCount: v.number(),
  summary: v.string(),
  snippet: v.string(),
  freshness: v.string(),
  status: v.optional(v.string()),
  existingNoteId: v.optional(v.string()),
  existingNoteTitle: v.optional(v.string()),
});

export const ImportPreviewSchema = v.looseObject({
  source: v.string(),
  scanned: v.number(),
  draftable: v.number(),
  importedCount: v.number(),
  samples: v.array(ImportSampleSchema),
});

/** The engine sends this tally twice: required on the imported entry, optional on its draft. */
const AccountingSchema = v.looseObject({
  providerCandidates: v.number(),
  normalizedAdditions: v.number(),
  parserRejections: v.number(),
  validationRejections: v.number(),
  deduplications: v.number(),
  keptUnits: v.number(),
});

export const ImportResultSchema = v.looseObject({
  batchStatus: v.string(),
  source: v.string(),
  imported: v.array(v.looseObject({
    sourceId: v.string(),
    title: v.string(),
    note: v.optional(NoteSchema),
    draft: v.nullish(v.looseObject({ ...DraftSchema.entries, accounting: v.optional(AccountingSchema) })),
    accounting: v.optional(AccountingSchema),
  })),
});

export const PreflightResponseSchema = v.looseObject({
  draftId: v.string(),
  selectedMutationIds: strings,
  readyMutationIds: strings,
  blockedMutationIds: strings,
  autoIncludedMutationIds: strings,
  rows: v.array(v.looseObject({
    mutationId: v.string(),
    targetId: v.string(),
    disposition: v.picklist(DISPOSITIONS),
    status: v.picklist(["ready", "blocked"]),
    autoIncluded: v.boolean(),
    blockers: v.array(v.looseObject({ code: v.string(), message: v.string() })),
    conflicts: v.array(ConflictSchema),
  })),
});

/** The reply names the index rebuild twice. Only the draft's copy is stored. */
export const AcceptResponseSchema = v.looseObject({
  draft: v.looseObject({
    id,
    status: v.string(),
    indexRebuildStatus: v.optional(v.string()),
    indexRebuildError: v.optional(v.string()),
  }),
  appliedMutationIds: v.optional(strings),
  skippedMutationIds: v.optional(strings),
  autoIncludedMutationIds: v.optional(strings),
});

/** `deleted` is true on every reply that gets this far. A draft that was not
 *  pending, or a mutation that was not there, answers 409 or 404 instead. */
export const SkipResponseSchema = v.looseObject({
  deleted: v.boolean(),
  draftId: v.optional(v.string()),
  mutationIds: strings,
});
