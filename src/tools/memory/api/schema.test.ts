// Fixtures are shaped from real dev-engine responses with the contents
// replaced, so an "accepts" case failing means the schema drifted, not the
// fixture.

import { describe, expect, it } from "vitest";
import * as v from "valibot";
import { AcceptResponseSchema, CharacterRowSchema, ChatSchema, ExtractResponseSchema, ImportPreviewSchema, ImportResultSchema, LtmStatusSchema, MutationSchema, NoteArchiveSchema, NoteSchema, NoteWriteSchema, PreflightResponseSchema, ReviewResponseSchema, SkipResponseSchema } from "./schema";

const ok = (schema: Parameters<typeof v.safeParse>[0], value: unknown) => v.safeParse(schema, value).success;

const note = () => ({
  id: "char_example",
  title: "Example",
  type: "character",
  status: "active",
  modes: ["roleplay"],
  scope: { characterIds: ["abc123"] },
  tags: ["typed_memory", "character"],
  keywords: ["example"],
  manualKeywords: [],
  suppressedKeywords: [],
  createdAt: "2026-08-21T19:48:28.561Z",
  updatedAt: "2026-08-21T19:48:28.561Z",
  version: 3,
  links: [{ target: "source_example", relation: "extracted_from" }],
  sections: {
    voice: {
      text: "- Speaks in questions.",
      updatedAt: "2026-08-21T19:48:28.561Z",
      salience: 0.85,
      confidence: 0.82,
      importance: "moderate",
      evidence: ["source_note:source_example"],
      contributions: [],
      dimensions: {},
    },
  },
  subjects: [{ key: "character:abc123", ref: { kind: "character", id: "abc123" } }],
});

describe("NoteSchema", () => {
  it("accepts a memory in the shape the live engine sends", () => {
    expect(ok(NoteSchema, note())).toBe(true);
  });

  it("keeps the fields it does not name, rather than stripping them", () => {
    const parsed = v.parse(NoteSchema, note());
    expect(parsed.scope).toEqual({ characterIds: ["abc123"] });
    expect(parsed.createdAt).toBe("2026-08-21T19:48:28.561Z");
    expect((parsed.sections.voice as { salience?: number }).salience).toBe(0.85);
  });

  it("accepts a field the engine has not shipped yet", () => {
    expect(ok(NoteSchema, { ...note(), somethingNewUpstream: { nested: true } })).toBe(true);
  });

  it("accepts a subject with no resolved ref", () => {
    expect(ok(NoteSchema, { ...note(), subjects: [{ key: "npc:watson" }] })).toBe(true);
  });

  it("rejects a subject sent as a bare string", () => {
    expect(ok(NoteSchema, { ...note(), subjects: ["character:abc123"] })).toBe(false);
  });

  it("accepts a memory with no subjects, which is most of them", () => {
    const { subjects, ...rest } = note();
    void subjects;
    expect(ok(NoteSchema, rest)).toBe(true);
  });

  it("accepts an empty section map", () => {
    expect(ok(NoteSchema, { ...note(), sections: {} })).toBe(true);
  });

  // A memory with no usable id keys `notesById` under `undefined`.
  it("rejects a memory with no id", () => {
    const { id, ...rest } = note();
    void id;
    expect(ok(NoteSchema, rest)).toBe(false);
  });

  it("rejects a memory whose id is empty", () => {
    expect(ok(NoteSchema, { ...note(), id: "" })).toBe(false);
  });

  it("rejects a write envelope handed over as if it were a memory", () => {
    expect(ok(NoteSchema, { note: note(), rebuild: {} })).toBe(false);
  });

  it("rejects a memory type the copy catalog cannot label", () => {
    expect(ok(NoteSchema, { ...note(), type: "faction" })).toBe(false);
  });

  it("rejects a status the copy catalog cannot label", () => {
    expect(ok(NoteSchema, { ...note(), status: "pending" })).toBe(false);
  });

  it("rejects a section whose text is missing", () => {
    expect(ok(NoteSchema, { ...note(), sections: { voice: { importance: "moderate" } } })).toBe(false);
  });
});

const mutation = () => ({
  id: "a4ee5529-bf35-4187-b72c-63f9fcd961dc",
  claimKind: "change",
  risk: "low",
  confidence: 0.96,
  summary: "Create timeline_event memory",
  evidence: ["source_note:source_example"],
  kind: "create_note",
  importance: "moderate",
  salience: 0.7,
  note: note(),
});

describe("MutationSchema", () => {
  it("accepts a create_note mutation carrying a whole memory", () => {
    expect(ok(MutationSchema, mutation())).toBe(true);
  });

  it("accepts the scoring fields the engine attaches and the console ignores", () => {
    const parsed = v.parse(MutationSchema, mutation());
    expect(parsed.salience).toBe(0.7);
  });

  it("rejects a mutation kind the console has no operation for", () => {
    expect(ok(MutationSchema, { ...mutation(), kind: "delete_note" })).toBe(false);
  });

  it("rejects a mutation whose confidence arrived as a string", () => {
    expect(ok(MutationSchema, { ...mutation(), confidence: "0.96" })).toBe(false);
  });
});

const review = () => ({
  generatedAt: "2026-08-24T01:00:00.000Z",
  sources: [{
    sourceNoteId: "source_example",
    modes: ["roleplay"],
    drafts: [{
      draft: {
        id: "draft-1",
        status: "pending",
        mutations: [mutation()],
        source: { sourceNoteId: "source_example" },
        applyState: "idle",
        reviewRequired: true,
        scope: {},
        accounting: {},
      },
      freshness: "fresh",
      blockReasons: [],
      diagnostics: [{ code: "x", severity: "info" }],
      candidateRejections: [{ reason: "invalid_format", message: "no", snippet: "…", index: 3 }],
      deduplications: [],
    }],
    targets: [{
      noteId: "note-1",
      title: "Example",
      noteType: "world",
      rows: [{
        draftId: "draft-1",
        mutation: mutation(),
        disposition: "merge",
        diagnostics: [],
        changes: [{ kind: "section", key: "voice", before: "a", after: "b" }],
      }],
    }],
  }],
  counts: { sources: 1, drafts: 1, mutations: 1, blockedDrafts: 0, candidateRejections: 1, deduplications: 0 },
});

describe("ReviewResponseSchema", () => {
  it("accepts the queue in the shape the live engine sends", () => {
    expect(ok(ReviewResponseSchema, review())).toBe(true);
  });

  it("accepts a queue with no sources", () => {
    expect(ok(ReviewResponseSchema, { ...review(), sources: [], counts: { sources: 0, drafts: 0, mutations: 0, blockedDrafts: 0, candidateRejections: 0, deduplications: 0 } })).toBe(true);
  });

  it("keeps the draft fields it does not name", () => {
    const parsed = v.parse(ReviewResponseSchema, review());
    expect(parsed.sources[0].drafts[0].draft.applyState).toBe("idle");
    expect(parsed.sources[0].drafts[0].deduplications).toEqual([]);
  });

  it("rejects a queue with no counts", () => {
    const { counts, ...rest } = review();
    void counts;
    expect(ok(ReviewResponseSchema, rest)).toBe(false);
  });

  it("rejects a count sent as a string", () => {
    expect(ok(ReviewResponseSchema, { ...review(), counts: { ...review().counts, drafts: "1" } })).toBe(false);
  });

  it("rejects a disposition the review screen has no column for", () => {
    const bad = review();
    bad.sources[0].targets[0].rows[0].disposition = "replace";
    expect(ok(ReviewResponseSchema, bad)).toBe(false);
  });
});

// The write fixtures are the live dev-engine replies with contents replaced.
// `rebuild` is verbatim: nothing reads it, and a change to it must still not
// fail a write.
const rebuild = () => ({ status: "complete", root: "/data/long-term-memory", generatedAt: "2026-08-25T08:22:31.487Z", noteCount: 31, chunkCount: 27, embeddedChunkCount: 0, embeddingsAvailable: false });

describe("NoteWriteSchema", () => {
  it("accepts the envelope PATCH actually sends", () => {
    expect(ok(NoteWriteSchema, { note: note(), rebuild: rebuild() })).toBe(true);
  });

  it("rejects a bare note sent without the envelope", () => {
    expect(ok(NoteWriteSchema, note())).toBe(false);
  });

  it("rejects a saved memory with no id, which is what poisoned the store", () => {
    const { id, ...rest } = note();
    void id;
    expect(ok(NoteWriteSchema, { note: rest, rebuild: rebuild() })).toBe(false);
  });

  it("rejects a saved memory whose id is empty", () => {
    expect(ok(NoteWriteSchema, { note: { ...note(), id: "" }, rebuild: rebuild() })).toBe(false);
  });
});

describe("NoteArchiveSchema", () => {
  const archive = () => ({ archived: true, note: note(), notes: [note(), { ...note(), id: "world_example", type: "world" }], rebuild: rebuild() });

  it("accepts the cascade DELETE actually sends", () => {
    expect(ok(NoteArchiveSchema, archive())).toBe(true);
  });

  it("accepts a cascade of one, where the target is the whole set", () => {
    expect(ok(NoteArchiveSchema, { ...archive(), notes: [note()] })).toBe(true);
  });

  it("rejects a reply carrying only the target and no set", () => {
    const { notes, ...rest } = archive();
    void notes;
    expect(ok(NoteArchiveSchema, rest)).toBe(false);
  });

  it("rejects the whole reply when one note in the cascade does not parse", () => {
    expect(ok(NoteArchiveSchema, { ...archive(), notes: [note(), { ...note(), status: "deleted" }] })).toBe(false);
  });
});

describe("ExtractResponseSchema", () => {
  const extraction = () => ({
    operationId: "5c9b3f22-0a7e-4a1e-9d2f-6d6a1b4c8e01",
    draft: { id: "d4dba4df-d77f-4afe-a142-0149e55c0e0f", status: "pending", mutations: [mutation()], source: { sourceNoteId: "source_example" } },
    diagnostics: [],
    outcome: { state: "draft_created", totalCandidates: 4, keptUnits: 3, droppedUnits: 1 },
    appliedMutationIds: [],
    skippedMutationIds: [],
  });

  it("accepts the extraction result the engine sends", () => {
    expect(ok(ExtractResponseSchema, extraction())).toBe(true);
  });

  it("accepts an extraction that produced no draft", () => {
    expect(ok(ExtractResponseSchema, { ...extraction(), draft: null })).toBe(true);
  });

  it("rejects the note envelope this route was wrongly typed as", () => {
    expect(ok(ExtractResponseSchema, { note: note(), rebuild: rebuild() })).toBe(false);
  });
});


const status = () => ({
  initialized: true,
  directory: "long-term-memory",
  notes: { total: 31, sourceNotes: 8, savedMemories: 23, pendingDrafts: 6, byType: { character: 3, source: 8 }, byStatus: { active: 30, resolved: 1 } },
  events: { logAvailable: true, bytes: 251367 },
  indexes: {
    health: "healthy", dirty: false, rebuildState: "idle", errors: [], warnings: [],
    generatedAt: "2026-08-25T08:54:36.984Z", noteCount: 23, chunkCount: 27,
    chunkFormatVersion: 4, embeddingsAvailable: false, embeddedChunkCount: 0,
  },
});

describe("LtmStatusSchema", () => {
  it("accepts the status the live engine sends", () => {
    expect(ok(LtmStatusSchema, status())).toBe(true);
  });

  it("accepts an index health the banner has no branch for", () => {
    expect(ok(LtmStatusSchema, { ...status(), indexes: { ...status().indexes, health: "quarantined" } })).toBe(true);
  });

  it("rejects a status with no counts, which every badge falls back to", () => {
    const { notes, ...rest } = status();
    void notes;
    expect(ok(LtmStatusSchema, rest)).toBe(false);
  });

  it("rejects a count sent as a string", () => {
    expect(ok(LtmStatusSchema, { ...status(), notes: { ...status().notes, total: "31" } })).toBe(false);
  });

  it("rejects a byType map whose members are not numbers", () => {
    expect(ok(LtmStatusSchema, { ...status(), notes: { ...status().notes, byType: { character: "3" } } })).toBe(false);
  });
});

const sample = () => ({
  sourceId: "lorebook_entry_7a821c05d6",
  title: "Lorebook - Example Book: Description",
  importMode: "roleplay",
  mutationCount: 1,
  summary: "Import Lorebook - Example Book: Description",
  snippet: "Category: world\n\nAn example entry.",
  status: "imported",
  freshness: "current",
  existingNoteId: "source_lorebook_7a821c05d638edf1",
  existingNoteTitle: "Lorebook - Example Book: Description",
});

const preview = () => ({ source: "lorebooks", scanned: 5, draftable: 0, importedCount: 5, samples: [sample()] });

describe("ImportPreviewSchema", () => {
  it("accepts the preview the live engine sends", () => {
    expect(ok(ImportPreviewSchema, preview())).toBe(true);
  });

  it("accepts a source kind that has nothing to scan", () => {
    expect(ok(ImportPreviewSchema, { source: "chats", scanned: 0, draftable: 0, importedCount: 0, samples: [] })).toBe(true);
  });

  it("accepts a sample that has not been imported", () => {
    const { existingNoteId, existingNoteTitle, ...rest } = sample();
    void existingNoteId; void existingNoteTitle;
    expect(ok(ImportPreviewSchema, { ...preview(), samples: [{ ...rest, status: "pending", freshness: "new" }] })).toBe(true);
  });

  it("keeps the note a sample became, which the row needs to link anything to it", () => {
    const parsed = v.parse(ImportPreviewSchema, preview());
    expect(parsed.samples[0].existingNoteId).toBe("source_lorebook_7a821c05d638edf1");
  });

  it("accepts a freshness the source rail falls back on rather than dropping the row", () => {
    expect(ok(ImportPreviewSchema, { ...preview(), samples: [{ ...sample(), freshness: "reimported" }] })).toBe(true);
  });

  it("rejects a preview with no samples array at all", () => {
    const { samples, ...rest } = preview();
    void samples;
    expect(ok(ImportPreviewSchema, rest)).toBe(false);
  });

  it("rejects a sample with no sourceId, which is the key the row is built on", () => {
    const { sourceId, ...rest } = sample();
    void sourceId;
    expect(ok(ImportPreviewSchema, { ...preview(), samples: [rest] })).toBe(false);
  });
});

const accounting = () => ({ providerCandidates: 4, normalizedAdditions: 0, parserRejections: 0, validationRejections: 1, deduplications: 0, keptUnits: 3 });

const importResult = () => ({
  operationId: "5c9b3f22-0a7e-4a1e-9d2f-6d6a1b4c8e01",
  batchStatus: "success",
  source: "lorebooks",
  imported: [{
    sourceId: "lorebook_entry_7a821c05d6",
    title: "Lorebook - Example Book: Description",
    note: note(),
    created: true,
    sourceWriteStatus: "created",
    extractionMethod: "llm",
    extractionStatus: "succeeded",
    retryable: false,
    accounting: accounting(),
    appliedMutationIds: [],
    skippedMutationIds: [],
    diagnostics: [],
    draft: { id: "d4dba4df-d77f-4afe-a142-0149e55c0e0f", status: "pending", mutations: [mutation()], source: { sourceNoteId: "source_example" }, accounting: accounting() },
  }],
  writeFailures: [],
  missingSourceIds: [],
});

describe("ImportResultSchema", () => {
  it("accepts the batch reply the engine's own response schema defines", () => {
    expect(ok(ImportResultSchema, importResult())).toBe(true);
  });

  it("accepts an entry whose extraction produced no draft", () => {
    const r = importResult();
    expect(ok(ImportResultSchema, { ...r, imported: [{ ...r.imported[0], draft: null }] })).toBe(true);
  });

  it("keeps the tally the report subtracts to get rejects", () => {
    const parsed = v.parse(ImportResultSchema, importResult());
    expect(parsed.imported[0].draft?.accounting?.keptUnits).toBe(3);
  });

  it("rejects a batch with no imported list, which the report iterates", () => {
    const { imported, ...rest } = importResult();
    void imported;
    expect(ok(ImportResultSchema, rest)).toBe(false);
  });

  it("rejects an entry whose draft carries a memory that does not parse", () => {
    const r = importResult();
    const bad = { ...r.imported[0], draft: { ...r.imported[0].draft, mutations: [{ ...mutation(), note: { ...note(), type: "faction" } }] } };
    expect(ok(ImportResultSchema, { ...r, imported: [bad] })).toBe(false);
  });
});

const preflight = () => ({
  draftId: "d4dba4df-d77f-4afe-a142-0149e55c0e0f",
  selectedMutationIds: ["a4ee5529-bf35-4187-b72c-63f9fcd961dc"],
  readyMutationIds: ["a4ee5529-bf35-4187-b72c-63f9fcd961dc"],
  blockedMutationIds: [],
  autoIncludedMutationIds: [],
  rows: [{
    mutationId: "a4ee5529-bf35-4187-b72c-63f9fcd961dc",
    targetId: "timeline_the_household_904998_0",
    disposition: "new",
    status: "ready",
    autoIncluded: false,
    blockers: [],
    conflicts: [],
  }],
});

describe("PreflightResponseSchema", () => {
  it("accepts the dry run the live engine sends", () => {
    expect(ok(PreflightResponseSchema, preflight())).toBe(true);
  });

  it("accepts the blocked run, which is where the dock's counts come from", () => {
    const p = preflight();
    expect(ok(PreflightResponseSchema, {
      ...p,
      readyMutationIds: ["37818514-8094-423b-88a0-149b245ab625"],
      blockedMutationIds: ["a35403cc-abf8-46a6-a9fe-0006afd66904"],
      autoIncludedMutationIds: ["37818514-8094-423b-88a0-149b245ab625"],
      rows: [
        { ...p.rows[0], mutationId: "37818514-8094-423b-88a0-149b245ab625", disposition: "merge", autoIncluded: true },
        {
          ...p.rows[0], mutationId: "a35403cc-abf8-46a6-a9fe-0006afd66904", disposition: "rewrite", status: "blocked",
          blockers: [{ code: "destructive_disposition_requires_explicit_review", message: "Rewrite and other destructive changes must be reviewed and applied one at a time." }],
        },
      ],
    })).toBe(true);
  });

  it("rejects a row status the badges have no branch for", () => {
    const p = preflight();
    expect(ok(PreflightResponseSchema, { ...p, rows: [{ ...p.rows[0], status: "deferred" }] })).toBe(false);
  });

  it("rejects a row with no blockers array, which the badge indexes into", () => {
    const p = preflight();
    const { blockers, ...rest } = p.rows[0];
    void blockers;
    expect(ok(PreflightResponseSchema, { ...p, rows: [rest] })).toBe(false);
  });

  it("rejects a verdict with no ready set, which Apply sends", () => {
    const { readyMutationIds, ...rest } = preflight();
    void readyMutationIds;
    expect(ok(PreflightResponseSchema, rest)).toBe(false);
  });
});

const accept = () => ({
  draft: {
    id: "d4dba4df-d77f-4afe-a142-0149e55c0e0f",
    status: "accepted",
    applyState: "complete",
    indexRebuildStatus: "succeeded",
  },
  appliedMutationIds: ["a4ee5529-bf35-4187-b72c-63f9fcd961dc"],
  skippedMutationIds: [],
  autoIncludedMutationIds: [],
  indexRebuild: { status: "succeeded" },
});

describe("AcceptResponseSchema", () => {
  it("accepts the apply reply the engine's own apply path returns", () => {
    expect(ok(AcceptResponseSchema, accept())).toBe(true);
  });

  it("accepts a reply whose rebuild failed, which raises the stale-recall toast", () => {
    const a = accept();
    expect(ok(AcceptResponseSchema, { ...a, draft: { ...a.draft, indexRebuildStatus: "failed", indexRebuildError: "index write failed" } })).toBe(true);
  });

  it("rejects a bare draft sent without the envelope", () => {
    expect(ok(AcceptResponseSchema, accept().draft)).toBe(false);
  });

  it("rejects a reply with no draft, which the rebuild check reads", () => {
    const { draft, ...rest } = accept();
    void draft;
    expect(ok(AcceptResponseSchema, rest)).toBe(false);
  });

  it("rejects applied ids sent as anything but strings", () => {
    expect(ok(AcceptResponseSchema, { ...accept(), appliedMutationIds: [{ id: "a4ee5529" }] })).toBe(false);
  });
});

describe("SkipResponseSchema", () => {
  const skip = () => ({ deleted: true, draftId: "d4dba4df-d77f-4afe-a142-0149e55c0e0f", mutationIds: ["a4ee5529-bf35-4187-b72c-63f9fcd961dc"], draft: { id: "d4dba4df-d77f-4afe-a142-0149e55c0e0f" } });

  it("accepts the skip reply the engine returns on the 2xx path", () => {
    expect(ok(SkipResponseSchema, skip())).toBe(true);
  });

  it("rejects a reply that does not say which claims went", () => {
    const { mutationIds, ...rest } = skip();
    void mutationIds;
    expect(ok(SkipResponseSchema, rest)).toBe(false);
  });

  it("rejects the error body the engine sends instead on 404", () => {
    expect(ok(SkipResponseSchema, { error: "Long-term memory draft mutation not found" })).toBe(false);
  });
});

describe("ChatSchema", () => {
  const chat = () => ({
    id: "glNX0E579GUq7mUEd3tF_",
    name: "Example chat",
    mode: "conversation",
    characterIds: ["p3XiZD7GIrsuyFVEFqqf9"],
    groupId: null,
    personaId: null,
    connectedChatId: null,
    metadata: { summary: null, tags: [] },
  });

  it("accepts the chat row the live host sends", () => {
    expect(ok(ChatSchema, chat())).toBe(true);
  });

  it("accepts a row whose name and mode are null", () => {
    expect(ok(ChatSchema, { ...chat(), name: null, mode: null })).toBe(true);
  });

  it("rejects a row with no id to scope by", () => {
    const { id, ...rest } = chat();
    void id;
    expect(ok(ChatSchema, rest)).toBe(false);
  });

  it("rejects a row whose id is empty", () => {
    expect(ok(ChatSchema, { ...chat(), id: "" })).toBe(false);
  });
});

describe("CharacterRowSchema", () => {
  const character = () => ({
    id: "sPXZrSrx2AbL9TovssKPR",
    data: "{\"name\":\"Example\",\"description\":\"An example card.\"}",
    comment: "",
    avatarPath: null,
    embedding: null,
  });

  it("accepts the character row the live host sends, with no hoisted name", () => {
    expect(ok(CharacterRowSchema, character())).toBe(true);
  });

  it("accepts a row whose card will not parse, which still has to name itself", () => {
    expect(ok(CharacterRowSchema, { ...character(), data: "not json" })).toBe(true);
  });

  it("rejects a card handed over as an object rather than the string field", () => {
    expect(ok(CharacterRowSchema, { ...character(), data: { name: "Example" } })).toBe(false);
  });

  it("rejects a row with no id to scope by", () => {
    const { id, ...rest } = character();
    void id;
    expect(ok(CharacterRowSchema, rest)).toBe(false);
  });
});
