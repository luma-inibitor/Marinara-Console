// The long-term-memory corpus: the notes, the review queue, the engine status,
// the import previews, and the two host lists the scope bar reads.
//
// These rows ARE guarded. `NoteSchema` and `ReviewResponseSchema` in
// src/tools/memory/api/schema.ts are the same schemas the running app parses
// these responses with, so tests/e2e/corpus.spec.ts parses the fixtures with
// them and fails on drift before any screen is opened. The typing below is the
// second half of that: `Note` and `ReviewResponse` are inferred FROM those
// schemas, so a required field that goes missing is a compile error too.
//
// There is deliberately more here than a smoke test needs. The checks that
// build on this harness measure crowding — a control's clearance from its
// neighbours — and a list of three rows has no crowded neighbours to measure,
// so every list screen carries eight rows or more.

import type { CharacterRow } from "../../../src/tools/memory/api/characters";
import type { Chat } from "../../../src/tools/memory/api/chats";
import type { ImportPreview, LtmStatus, Note, ReviewResponse } from "../../../src/tools/memory/api/types";

/** The memory the detail screen opens. It carries four sections because the
 *  detail view lists one row per section and a one-section note would leave
 *  that list untested. */
export const NOTE_ID = "mem-harbour-fog";

const SRC_HARBOUR = "src-lorebook-harbour";
const SRC_CAST = "src-character-mira";
const SRC_CHAT = "src-chat-tuesday";
const SRC_MARKET = "src-lorebook-market";

/** Every field the wire requires, at an inert value, so a note below states
 *  only what it is about. */
const note = (over: Partial<Note> & Pick<Note, "id" | "type" | "title">): Note => ({
  status: "active",
  modes: ["conversation"],
  links: [],
  sections: {},
  updatedAt: "2026-02-13T08:00:00.000Z",
  ...over,
});

/** A memory extracted from a source note, which is how every stored memory in
 *  this corpus came to exist: the Sources screen indexes them by that link. */
const memory = (
  source: string,
  over: Partial<Note> & Pick<Note, "id" | "type" | "title">,
): Note => note({ links: [{ target: source, relation: "extracted_from" }], ...over });

const SOURCE_NOTES: Note[] = [
  note({
    id: SRC_HARBOUR, type: "source", title: "Lorebook - Atlas of the Harbour: The harbour",
    provenance: { kind: "lorebook", sourceId: "lb-atlas:e-harbour" },
    sections: { body: { text: "Sea-fog sits in the harbour until midday. The tide boards are chalked at dawn and nobody trusts them after noon." } },
  }),
  note({
    id: SRC_MARKET, type: "source", title: "Lorebook - Atlas of the Harbour: Fishmarket",
    provenance: { kind: "lorebook", sourceId: "lb-atlas:e-market" },
    sections: { body: { text: "Open before light, shut by ten. The stalls nearest the water pay the least rent and flood first." } },
  }),
  note({
    id: SRC_CAST, type: "source", title: "Character - Mira Vance",
    provenance: { kind: "character", sourceId: "char-mira" },
    sections: { body: { text: "Harbourmaster for nine years. Signs the tide boards herself." } },
  }),
  note({
    id: SRC_CHAT, type: "source", title: "Tuesday crossing",
    provenance: { kind: "chat_summary", sourceId: "chat-tuesday" },
    modes: ["conversation", "roleplay"],
    sections: { body: { text: "The ferry did not run. Mira would not sign the boards and Tolley would not cross." } },
  }),
];

const MEMORIES: Note[] = [
  memory(SRC_HARBOUR, {
    id: NOTE_ID, type: "world", title: "The harbour keeps its fog until midday",
    keywords: ["harbour", "fog", "tide"], manualKeywords: ["fog line"],
    sections: {
      summary: { text: "Fog holds in the harbour until about midday and the lamps are useless past the fog line.", importance: "high" },
      detail: { text: "The bell, not the lamps, is what boats navigate by in the mornings. Crews treat the fog line as the edge of the harbour rather than the wall." },
      continuity: { text: "Established Tuesday: the ferry does not cross in fog, at any price." },
      caution: { text: "Do not describe the fog as beautiful. Nobody who lives here would." },
    },
  }),
  memory(SRC_HARBOUR, {
    id: "mem-tide-boards", type: "world", title: "The tide boards are chalked at dawn and doubted by noon",
    keywords: ["tide", "boards"],
    sections: { summary: { text: "Chalk on slate at the harbour steps, rewritten each dawn and wrong often enough that nobody plans around them." } },
  }),
  memory(SRC_HARBOUR, {
    id: "mem-bell", type: "world", title: "The tide bell rings twice for a return, three times for a wreck",
    sections: { summary: { text: "Three rings has not happened in eleven years, and everyone in the harbour knows the count." } },
  }),
  memory(SRC_MARKET, {
    id: "mem-market-hours", type: "world", title: "The fishmarket opens before light and shuts by ten",
    sections: { summary: { text: "The stalls nearest the water are cheapest and flood first, which is the whole economics of the place." } },
  }),
  memory(SRC_CAST, {
    id: "mem-mira-post", type: "character", title: "Mira Vance has been harbourmaster for nine years",
    keywords: ["mira", "harbourmaster"],
    subjects: [{ key: "character:mira", ref: { kind: "character", id: "char-mira" } }],
    sections: { summary: { text: "She signs the tide boards herself because the last clerk guessed at them." } },
  }),
  memory(SRC_CAST, {
    id: "mem-mira-voice", type: "tone", title: "Mira speaks in instructions, not opinions",
    sections: { summary: { text: "She gives the reader something to do rather than something to feel." } },
  }),
  memory(SRC_CHAT, {
    id: "mem-tolley-refusal", type: "relationship", title: "Tolley will not cross after the bell",
    modes: ["conversation", "roleplay"],
    links: [{ target: SRC_CHAT, relation: "extracted_from" }, { target: "mem-mira-post", relation: "concerns" }],
    sections: { summary: { text: "Not a negotiation and not superstition; he has said so twice and given no reason either time." } },
  }),
  memory(SRC_CHAT, {
    id: "mem-tuesday", type: "timeline_event", title: "Tuesday: the ferry did not run",
    modes: ["conversation", "roleplay"],
    sections: { summary: { text: "Mira would not sign the boards, so Tolley would not cross, so nobody crossed." } },
  }),
  memory(SRC_CHAT, {
    id: "mem-crossing-thread", type: "thread", title: "Someone still needs to reach the far shore",
    status: "active",
    sections: { summary: { text: "Open since Tuesday. The ferry is the only crossing and the ferry is not running." } },
  }),
  memory(SRC_MARKET, {
    id: "mem-old-rent", type: "world", title: "Stall rents were raised last winter", status: "archived",
    sections: { summary: { text: "Superseded by the market-hours memory; kept archived to show the vault's filter has something to filter." } },
  }),
];

export const NOTES: Note[] = [...SOURCE_NOTES, ...MEMORIES];

export const STATUS: LtmStatus = {
  notes: {
    total: NOTES.length,
    sourceNotes: SOURCE_NOTES.length,
    savedMemories: MEMORIES.filter((n) => n.status !== "archived").length,
    pendingDrafts: 3,
    byType: { source: SOURCE_NOTES.length, world: 5, character: 1, relationship: 1, timeline_event: 1, thread: 1, tone: 1 },
    byStatus: { active: MEMORIES.length - 1, archived: 1 },
  },
  // Healthy and embedded: both banners this screen can raise are conditions,
  // not the resting state, and a fixture that raises one on every screen makes
  // the banner invisible to a test that means to assert on it.
  indexes: { health: "healthy", dirty: false, rebuildState: "idle", embeddingsAvailable: true },
};

// ── the review queue ────────────────────────────────────────────────
// One draft per source, flattened by the console into one row per mutation.
// The fourth draft is BLOCKED: its rows never reach the queue, so it is what
// keeps the blocked-draft banner and the Sources screen's block codes honest.

type Mutation = ReviewResponse["sources"][number]["targets"][number]["rows"][number]["mutation"];

const mutation = (over: Partial<Mutation> & Pick<Mutation, "id" | "kind" | "summary">): Mutation => ({
  claimKind: "static",
  risk: "low",
  confidence: 0.94,
  evidence: [],
  ...over,
});

const write = (id: string, sectionKey: string, text: string, over: Partial<Mutation> = {}): Mutation =>
  mutation({ id, kind: "append_section", summary: text.slice(0, 60), sectionKey, text, ...over });

const row = (draftId: string, m: Mutation, disposition: "new" | "merge" | "rewrite" = "merge") =>
  ({ draftId, mutation: m, disposition, diagnostics: [], changes: [] });

export const REVIEW: ReviewResponse = {
  generatedAt: "2026-02-14T19:02:00.000Z",
  sources: [
    {
      sourceNoteId: SRC_HARBOUR,
      modes: ["conversation"],
      drafts: [{
        draft: {
          id: "draft-harbour", status: "ready",
          source: { sourceNoteId: SRC_HARBOUR },
          mutations: [],
        },
        freshness: "current", blockReasons: [], diagnostics: [], candidateRejections: [],
      }],
      targets: [
        {
          noteId: NOTE_ID, title: "The harbour keeps its fog until midday", noteType: "world",
          rows: [
            row("draft-harbour", write("m-fog-detail", "detail", "The bell is rung from the west wall, which is why it sounds nearer than it is.")),
            row("draft-harbour", write("m-fog-caution", "caution", "Do not have a character mention the fog lifting early; it never has.")),
            row("draft-harbour", write("m-fog-risk", "detail", "Lamp oil is rationed in winter and the west wall is lit last.", { risk: "medium", confidence: 0.61 })),
          ],
        },
        {
          noteId: "mem-tide-boards", title: "The tide boards are chalked at dawn and doubted by noon", noteType: "world",
          rows: [
            row("draft-harbour", write("m-boards-1", "summary", "Two boards, not one: the steps and the ferry slip, and they disagree about twice a month.")),
            row("draft-harbour", write("m-boards-2", "continuity", "Mira signs both. The signature is the only reason anyone reads them.")),
          ],
        },
      ],
    },
    {
      sourceNoteId: SRC_CAST,
      modes: ["conversation"],
      drafts: [{
        draft: { id: "draft-mira", status: "ready", source: { sourceNoteId: SRC_CAST }, mutations: [] },
        freshness: "current", blockReasons: [], diagnostics: [],
        candidateRejections: [
          { reason: "duplicate", message: "Already stored as mem-mira-post.", snippet: "Harbourmaster for nine years." },
        ],
      }],
      targets: [
        {
          noteId: "mem-mira-post", title: "Mira Vance has been harbourmaster for nine years", noteType: "character",
          rows: [
            row("draft-mira", write("m-mira-1", "summary", "Nine years, and she took the post after the wreck rather than before it.")),
            row("draft-mira", mutation({ id: "m-mira-kw", kind: "set_keywords", summary: "Add keywords: boards, signature", keywords: ["boards", "signature"] })),
          ],
        },
        {
          noteId: "mem-new-merrow", title: "Merrow keeps the far-shore light", noteType: "character",
          rows: [
            row("draft-mira", mutation({
              id: "m-merrow", kind: "create_note", claimKind: "change", risk: "medium", confidence: 0.72,
              summary: "New memory: Merrow keeps the far-shore light",
              note: note({
                id: "mem-new-merrow", type: "character", title: "Merrow keeps the far-shore light",
                sections: { summary: { text: "Named twice on Tuesday and never seen. Keeps the light on the far shore and does not cross either." } },
              }),
            }), "new"),
          ],
        },
      ],
    },
    {
      sourceNoteId: SRC_CHAT,
      modes: ["conversation", "roleplay"],
      drafts: [
        {
          draft: { id: "draft-tuesday", status: "ready", source: { sourceNoteId: SRC_CHAT, chatId: "chat-tuesday" }, mutations: [] },
          freshness: "current", blockReasons: [], diagnostics: [], candidateRejections: [],
        },
        {
          // Held back: every row under this draft id is dropped before the
          // queue, which is what the console's block handling has to get right.
          draft: { id: "draft-tuesday-late", status: "blocked", source: { sourceNoteId: SRC_CHAT }, mutations: [] },
          freshness: "source_updated",
          blockReasons: [{ code: "source_stale", message: "The chat has moved on since this draft was extracted." }],
          diagnostics: [], candidateRejections: [],
        },
      ],
      targets: [
        {
          noteId: "mem-tolley-refusal", title: "Tolley will not cross after the bell", noteType: "relationship",
          rows: [
            row("draft-tuesday", write("m-tolley-1", "summary", "He said it twice on Tuesday and gave no reason either time.")),
            row("draft-tuesday", write("m-tolley-2", "continuity", "Mira did not argue with him, which is itself the point.")),
            row("draft-tuesday-late", write("m-tolley-held", "summary", "Held behind a stale draft; this row must never reach the queue.")),
          ],
        },
        {
          noteId: "mem-tuesday", title: "Tuesday: the ferry did not run", noteType: "timeline_event",
          rows: [
            row("draft-tuesday", write("m-tuesday-1", "summary", "Nobody crossed. The market took the difference in unsold fish.")),
            row("draft-tuesday", mutation({ id: "m-tuesday-link", kind: "add_link", summary: "Link to the crossing thread", link: { target: "mem-crossing-thread", relation: "concerns" } })),
          ],
        },
      ],
    },
  ],
  counts: {
    sources: 3,
    drafts: 4,
    // Thirteen claims on the wire; the held draft's is not one of the twelve
    // the queue lists, and the console is expected to say twelve.
    mutations: 13,
    blockedDrafts: 1,
    candidateRejections: 1,
    deduplications: 2,
  },
};

/** Rows the review queue lists: everything above, minus the held draft's. */
export const REVIEW_ROWS = REVIEW.sources
  .flatMap((s) => s.targets.flatMap((t) => t.rows))
  .filter((r) => r.draftId !== "draft-tuesday-late").length;

// ── the sources workspace ───────────────────────────────────────────
// There is no /long-term-memory/sources route. The screen is assembled from
// three previews, the notes above and the review response above (see
// src/tools/memory/store/sources.ts), so the preview rows below have to name
// note ids that exist here or the screen shows sources with nothing derived.

type Sample = ImportPreview["samples"][number];

const sample = (over: Partial<Sample> & Pick<Sample, "sourceId" | "title" | "freshness">): Sample => ({
  importMode: "conversation",
  mutationCount: 0,
  summary: "",
  snippet: "",
  ...over,
});

/** `existingNoteId` is not on `ImportPreview["samples"]`: the store reads it
 *  through a cast because the engine sends it and the type predates it. The
 *  cast is what lets a preview row find the source note it became. */
const imported = (over: Partial<Sample> & Pick<Sample, "sourceId" | "title" | "freshness">, existingNoteId: string): Sample =>
  ({ ...sample(over), existingNoteId } as Sample);

const preview = (source: string, samples: Sample[], importedCount: number): ImportPreview => ({
  source,
  scanned: samples.length,
  draftable: samples.length - importedCount,
  importedCount,
  samples,
});

export const PREVIEWS: Record<string, ImportPreview> = {
  lorebooks: preview("lorebooks", [
    imported({ sourceId: "lb-atlas:e-harbour", title: "Lorebook - Atlas of the Harbour: The harbour", freshness: "current", snippet: "Sea-fog sits in the harbour until midday.", mutationCount: 3 }, SRC_HARBOUR),
    imported({ sourceId: "lb-atlas:e-market", title: "Lorebook - Atlas of the Harbour: Fishmarket", freshness: "source_updated", snippet: "Open before light, shut by ten.", mutationCount: 1 }, SRC_MARKET),
    sample({ sourceId: "lb-atlas:e-fogline", title: "Lorebook - Atlas of the Harbour: The fog line", freshness: "new", snippet: "Past the fog line the lamps are useless." }),
    sample({ sourceId: "lb-atlas:e-tidebell", title: "Lorebook - Atlas of the Harbour: Tide bell", freshness: "new", snippet: "Rung twice for a returning boat." }),
    sample({ sourceId: "lb-cast:c-tolley", title: "Lorebook - Standing Cast: Tolley", freshness: "new", snippet: "Speaks in half sentences." }),
    sample({ sourceId: "lb-cast:c-chorus", title: "Lorebook - Standing Cast: Dock chorus", freshness: "new", snippet: "Six voices, no names, one opinion." }),
  ], 2),
  characters: preview("characters", [
    imported({ sourceId: "char-mira", title: "Character - Mira Vance", freshness: "current", snippet: "Harbourmaster for nine years.", mutationCount: 2 }, SRC_CAST),
    sample({ sourceId: "char-tolley", title: "Character - Tolley", freshness: "new", snippet: "Runs the ferry. Will not cross after the bell." }),
    sample({ sourceId: "char-merrow", title: "Character - Merrow", freshness: "new", snippet: "Keeps the far-shore light." }),
  ], 1),
  chats: preview("chats", [
    imported({ sourceId: "chat-tuesday", title: "Tuesday crossing", freshness: "extraction_incomplete", importMode: "roleplay", snippet: "The ferry did not run.", mutationCount: 5 }, SRC_CHAT),
    sample({ sourceId: "chat-monday", title: "Monday, the long walk", freshness: "new", importMode: "roleplay", snippet: "Two hours around the head of the water." }),
    sample({ sourceId: "chat-market", title: "Market morning", freshness: "new", snippet: "Nothing happened, at length." }),
  ], 1),
};

// ── the host's own lists, which are not long-term-memory routes ─────

export const CHATS: Chat[] = [
  { id: "chat-tuesday", name: "Tuesday crossing", mode: "roleplay", characterIds: ["char-mira"] },
  { id: "chat-monday", name: "Monday, the long walk", mode: "roleplay", characterIds: ["char-mira", "char-tolley"] },
  { id: "chat-market", name: "Market morning", mode: "conversation", characterIds: ["char-tolley"] },
];

/** The host hoists `name` out of the card only sometimes, so one row here
 *  leaves it in the JSON string and one card is unparseable — both paths
 *  `parseCharacter` has. */
export const CHARACTERS: CharacterRow[] = [
  { id: "char-mira", name: "Mira Vance", data: JSON.stringify({ name: "Mira Vance" }) },
  { id: "char-tolley", data: JSON.stringify({ name: "Tolley" }) },
  { id: "char-merrow", data: "{not json" },
];
