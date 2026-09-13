import type { Note, NoteSection } from "../api/types";

/** One memory of each type, shaped like the seeded corpus. */

const SOURCE_ID = "source_lorebook_d81a750ad0c1a6d7";
const SOURCE_HASH = "9f2c4b7e1d0a6c3f5e8b2a4d7c1f0e9b3a6d5c8f2e1b4a7d0c3f6e9b2a5d8c1f";
const CHAT_SOURCE_ID = "source_chat_summary_4b1e7a2c9d0f3e6a";
const EVENT_ID = "timeline_ferry_did_not_run";
const CHARACTER_HOST = "sPXZrSrx2AbL9TovssKPR";

const T0 = "2026-08-19T09:12:00.000Z";
const T1 = "2026-08-23T14:40:00.000Z";

const fromSource = {
  owner: "source",
  sourceNoteId: SOURCE_ID,
  sourceHash: SOURCE_HASH,
  updatedAt: T1,
  confidence: 0.86,
};

const section = (text: string, over: Partial<NoteSection> = {}): NoteSection => ({
  text,
  updatedAt: T1,
  confidence: 0.86,
  evidence: [`source_note:${SOURCE_ID}`],
  salience: 0.62,
  contributions: [fromSource],
  ...over,
});

const note = (over: Partial<Note> & Pick<Note, "id" | "type" | "sections">): Note => ({
  status: "active",
  modes: ["roleplay"],
  scope: { characterIds: [CHARACTER_HOST] },
  tags: ["typed_memory"],
  keywords: [],
  createdAt: T0,
  updatedAt: T1,
  links: [{ target: SOURCE_ID, relation: "extracted_from" }],
  version: 3,
  ...over,
});

const SOURCE = note({
  id: SOURCE_ID,
  type: "source",
  title: "Lorebook - Atlas of the Harbour: The harbour",
  modes: ["roleplay", "conversation"],
  scope: {},
  tags: ["source_summary", "imported_lorebook", "lorebook_world"],
  links: [],
  provenance: { kind: "lorebook", sourceId: "JZzGg_2NjFx1hFP_G4Yeq", entryId: "hORdkj30zlv8QfikWnsgj" },
  extractionFingerprint: {
    version: 3,
    sourceHash: SOURCE_HASH,
    provenance: { kind: "lorebook", sourceId: "JZzGg_2NjFx1hFP_G4Yeq", entryId: "hORdkj30zlv8QfikWnsgj" },
    scope: {},
    modes: ["roleplay", "conversation"],
    extractionMode: "roleplay",
  },
  sections: {
    source: {
      text: [
        "Sea-fog sits in the harbour until midday. The tide boards are chalked at dawn and nobody trusts them after noon.",
        "The bell, not the lamps, is what boats navigate by in the mornings. Two rings for a return, three for a wreck; three has not happened in eleven years and everyone knows the count.",
        "Stalls nearest the water pay the least rent and flood first, which is the whole economics of the fishmarket. It opens before light and shuts by ten.",
        "The harbourmaster signs the tide boards herself because the last clerk guessed at them. She has held the post nine years and speaks in instructions rather than opinions.",
        "The ferry is the only crossing. It does not run in fog, at any price, and the far shore is a day's walk round by the cliff road.",
        "Lamps are useless past the fog line. Crews treat the line as the edge of the harbour rather than the wall, and nobody who lives here calls the fog beautiful.",
      ].join("\n"),
      updatedAt: T1,
      confidence: 0.8,
      evidence: ["lorebook:JZzGg_2NjFx1hFP_G4Yeq", "lorebook_entry:hORdkj30zlv8QfikWnsgj"],
    },
  },
});

const TIMELINE_EVENT = note({
  id: EVENT_ID,
  type: "timeline_event",
  title: "Tuesday: the ferry did not run",
  tags: ["typed_memory", "timeline_event"],
  links: [{ target: CHAT_SOURCE_ID, relation: "extracted_from" }],
  sections: {
    event: section("Mira would not sign the boards, so Tolley would not cross, so nobody crossed.", {
      importance: "major",
      salience: 0.97,
      evidence: [`source_note:${CHAT_SOURCE_ID}`],
      contributions: [{ ...fromSource, sourceNoteId: CHAT_SOURCE_ID }],
    }),
  },
});

const CHARACTER = note({
  id: "char_mira_vance",
  type: "character",
  title: "Mira Vance",
  modes: ["roleplay", "conversation", "game"],
  keywords: ["mira", "harbourmaster", "tide boards", "the bell", "fog line", "harbour"],
  manualKeywords: ["Vance"],
  suppressedKeywords: ["harbour"],
  subjects: [{ key: `character:${CHARACTER_HOST}`, ref: { kind: "character", id: CHARACTER_HOST } }],
  links: [
    { target: SOURCE_ID, relation: "extracted_from" },
    { target: EVENT_ID, relation: "caused_by" },
  ],
  sections: {
    core: section(
      "Harbourmaster for nine years. Signs the tide boards herself because the last clerk guessed at them.",
      {
        importance: "critical",
        confidence: 0.94,
        salience: 0.81,
      },
    ),
    voice: section(
      "Speaks in instructions, not opinions. Gives the reader something to do rather than something to feel.",
      {
        importance: "major",
        evidence: [`source_note:${SOURCE_ID}`, "Mira: Hold the line there. No, there."],
      },
    ),
    backstory: section(
      "Took the post the winter the old harbourmaster drowned. Came from the cliff road villages and has never said which.",
      { importance: "moderate", confidence: 0.71, salience: 0.4 },
    ),
    habits: section("Chalks the boards before the lamps are out. Drinks nothing at the market, ever.", {
      importance: "minor",
      salience: undefined,
      contributions: undefined,
    }),
    appearance: section("Grey oilskin, cropped hair, chalk on the right cuff.", { importance: "minor" }),
  },
});

const RELATIONSHIP = note({
  id: "rel_mira_tolley",
  type: "relationship",
  title: "Mira and Tolley",
  tags: ["typed_memory", "relationship_memory"],
  subjects: [
    { key: `character:${CHARACTER_HOST}`, ref: { kind: "character", id: CHARACTER_HOST } },
    { key: "npc:tolley" },
  ],
  links: [
    { target: CHAT_SOURCE_ID, relation: "extracted_from" },
    { target: EVENT_ID, relation: "caused_by" },
  ],
  sections: {
    state: section("Tolley defers to Mira on the boards and on nothing else. Neither has said why.", {
      importance: "major",
      evidence: [`source_note:${CHAT_SOURCE_ID}`],
      contributions: [{ ...fromSource, sourceNoteId: CHAT_SOURCE_ID }],
      dimensions: { trust: 72, respect: 80, tension: 35, dependency: 55 },
      dimensionChanges: { trust: 5, tension: -10 },
    }),
  },
});

const SCENE = note({
  id: "scene_harbour_steps_dawn",
  type: "scene",
  title: "Dawn at the harbour steps",
  modes: ["roleplay"],
  links: [{ target: CHAT_SOURCE_ID, relation: "extracted_from" }],
  sections: {
    scene: section("Fog to the second step. Mira with the chalk, Tolley on the ferry rail, the bell not yet rung.", {
      importance: "moderate",
      salience: 0.5,
      contributions: [{ ...fromSource, sourceNoteId: CHAT_SOURCE_ID }],
    }),
  },
});

const THREAD = note({
  id: "thread_reach_the_far_shore",
  type: "thread",
  title: "Someone still needs to reach the far shore",
  status: "resolved",
  scope: {
    chatId: "Dtb4Rx1i9n41s6V83jZ3l",
    chatIds: ["Dtb4Rx1i9n41s6V83jZ3l"],
    characterIds: [CHARACTER_HOST],
    personaId: "rPTDHjDoKtoQdORarmZky",
    personaIds: ["rPTDHjDoKtoQdORarmZky"],
  },
  links: [
    { target: CHAT_SOURCE_ID, relation: "extracted_from" },
    { target: EVENT_ID, relation: "caused_by" },
  ],
  sections: {
    state: section("Open since Tuesday. The ferry is the only crossing and the ferry is not running.", {
      importance: "major",
      contributions: [{ ...fromSource, sourceNoteId: CHAT_SOURCE_ID }],
    }),
    summary: section("Resolved on Thursday when the fog lifted early and Tolley crossed before the bell.", {
      contributions: [{ owner: "manual", updatedAt: T1 }],
      evidence: [],
    }),
  },
});

const WORLD = note({
  id: "world_harbour_fog",
  type: "world",
  title: "The harbour keeps its fog until midday",
  scope: {},
  sections: {
    canon: section(
      "Fog holds in the harbour until about midday and the lamps are useless past the fog line.\nThe bell, not the lamps, is what boats navigate by in the mornings.\nCrews treat the fog line as the edge of the harbour rather than the wall.",
      { importance: "critical", salience: 0.74 },
    ),
  },
});

const TONE = note({
  id: "tone_mira_voice",
  type: "tone",
  title: "Mira speaks in instructions, not opinions",
  sections: {
    observations: section("Short declaratives. Never a question she does not already know the answer to.", {
      evidence: [`source_note:${SOURCE_ID}`, "Mira: You will wait for the bell."],
    }),
    profile: section("Clipped, practical, dry. Warmth shows as extra instructions rather than softer ones.", {
      importance: "major",
    }),
  },
});

/** A note carrying only what the wire requires. */
export const BARE: Note = {
  id: "world_untitled",
  type: "world",
  status: "active",
  modes: ["conversation"],
  links: [],
  sections: { canon: { text: "Nothing else is known." } },
};

const CHAT_SOURCE = note({
  id: CHAT_SOURCE_ID,
  type: "source",
  title: "Tuesday crossing",
  scope: {},
  tags: ["source_summary", "imported_chat_summary"],
  links: [],
  provenance: { kind: "chat_summary", sourceId: "Dtb4Rx1i9n41s6V83jZ3l" },
  sections: { source: { text: "The ferry did not run.", updatedAt: T1, confidence: 0.8, evidence: [] } },
});

export const BY_TYPE = {
  source: SOURCE,
  timeline_event: TIMELINE_EVENT,
  character: CHARACTER,
  relationship: RELATIONSHIP,
  scene: SCENE,
  thread: THREAD,
  world: WORLD,
  tone: TONE,
} satisfies Record<Note["type"], Note>;

/** Every fixture, so a link target resolves. */
export const CORPUS: Note[] = [...Object.values(BY_TYPE), CHAT_SOURCE, BARE];
