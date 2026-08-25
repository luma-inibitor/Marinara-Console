// The wire shapes of the read paths the vault and the review queue depend on,
// as schemas that run rather than interfaces that are asserted.
//
// These are the runtime half of `types.ts`, and the types there are inferred
// from here so the two cannot drift. What is NOT here stays hand-written in
// `types.ts` for now — the write paths, import, status, backup, chats,
// characters and the ledger — and those still travel on an unchecked `as T`.
//
// Two rules shape every schema below.
//
// Loose, everywhere. `v.looseObject` keeps the fields it does not name. The
// live engine already sends more than `types.ts` ever described — `scope`,
// `createdAt` and `extractionFingerprint` on every note, `deduplications`
// beside every draft — and a schema that rejected those would fail against the
// engine it was written from. Unknown fields are not evidence of a problem.
//
// Narrow, deliberately. A field is required here only when the console cannot
// do its job without it, because required is what turns a mismatch into a
// dropped record. `id` is required because a memory without one poisons the
// notes map under the key `undefined`. `type` and `status` are closed sets
// because the copy catalog has one label per member and no fallback. Salience,
// confidence and the rest of the engine's scoring ride through unnamed: the
// console shows them at most, and showing nothing beats dropping the memory.
import * as v from "valibot";

/** Every memory type the copy catalog can label. A note carrying anything else
 *  is a real engine change, and is reported rather than rendered blank. */
export const NOTE_TYPES = ["source", "timeline_event", "character", "relationship", "scene", "thread", "world", "tone"] as const;
const NOTE_STATUSES = ["active", "resolved", "archived"] as const;
const DISPOSITIONS = ["new", "merge", "rewrite"] as const;
const RISKS = ["low", "medium", "high"] as const;
const MUTATION_KINDS = ["create_note", "append_section", "update_section", "add_link", "set_keywords", "set_status", "set_subjects"] as const;
const CHANGE_KINDS = ["section", "link", "keywords", "status", "subjects"] as const;

const id = v.pipe(v.string(), v.minLength(1));
const strings = v.array(v.string());

export const NoteSectionSchema = v.looseObject({
  text: v.string(),
  importance: v.optional(v.string()),
});

/** Who a memory is about. `types.ts` called this `string[]` and it never was:
 *  the engine sends `{key, ref?}`, where `key` is a scoped identity
 *  ("character:sPXZ…", "npc:watson") and `ref` resolves it to a host record
 *  when there is one to resolve. An npc that exists only in the prose has a
 *  key and no ref. Nothing in the console reads the values yet, which is why
 *  the wrong type survived. */
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

const DraftEntrySchema = v.looseObject({
  draft: v.looseObject({
    id,
    status: v.string(),
    mutations: v.array(MutationSchema),
    source: v.optional(v.looseObject({ sourceNoteId: v.optional(v.string()), chatId: v.optional(v.string()) })),
  }),
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
