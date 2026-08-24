// The two product rules in scope.ts, asserted as intent rather than as
// whatever the code happens to do: an unscoped memory is available everywhere,
// and a record that cannot be placed is shown rather than hidden. Both were
// verified by hand against live data, and both are the kind of rule a later
// "obvious" simplification of the predicate would quietly invert.
//
// Also pinned: the singular/plural id reading (the engine writes `chatId`
// beside `chatIds`), and which level governs when both are selected.
//
// `useScope` is deliberately uncovered — it is a React hook and this suite runs
// in the node environment with no DOM.

import { beforeEach, describe, expect, it } from "vitest";
import type { Note, Row } from "./data";
import {
  currentScope,
  isScoped,
  noteInScope,
  rowInScope,
  scopeCharacterId,
  scopeChatId,
  setScope,
  setScopeCharacter,
  type Scope,
} from "./scope";
import { makeNote, makeRow, resetIds } from "./test/factories";

/** The stores are module-level singletons seeded from localStorage at import
 *  time, so a test that writes scope leaks into every test after it unless the
 *  singletons themselves are put back. */
beforeEach(() => {
  scopeChatId.set("");
  scopeCharacterId.set("");
  localStorage.clear();
  resetIds();
});

const scope = (over: Partial<Scope> = {}): Scope => ({ characterId: "", chatId: "", ...over });

/** `scope` is not a declared field on Note, it rides the wire type's index
 *  signature — so it is built here rather than through a factory argument. */
const scoped = (noteScope: unknown): Note => makeNote({ scope: noteScope });

describe("isScoped", () => {
  it("is false when nothing is selected", () => {
    expect(isScoped(scope())).toBe(false);
  });

  it("is true when either level is selected", () => {
    expect(isScoped(scope({ chatId: "chat-1" }))).toBe(true);
    expect(isScoped(scope({ characterId: "char-1" }))).toBe(true);
    expect(isScoped(scope({ characterId: "char-1", chatId: "chat-1" }))).toBe(true);
  });
});

describe("noteInScope with no scope selected", () => {
  it("passes every note", () => {
    expect(noteInScope(scoped({ chatIds: ["other"] }), scope())).toBe(true);
  });

  it("passes a note that is not loaded", () => {
    expect(noteInScope(undefined, scope())).toBe(true);
  });
});

describe("an unscoped memory is available everywhere", () => {
  // The rule that keeps imported lorebook sources from vanishing the moment a
  // scope is picked: they arrive declaring neither chats nor characters.
  const everywhere: unknown[] = [undefined, {}, { chatIds: [], characterIds: [] }, { chatId: "", characterId: "" }];

  for (const [i, noteScope] of everywhere.entries()) {
    it(`passes under any selected scope (declaration ${i})`, () => {
      expect(noteInScope(scoped(noteScope), scope({ chatId: "chat-1" }))).toBe(true);
      expect(noteInScope(scoped(noteScope), scope({ characterId: "char-1" }))).toBe(true);
      expect(noteInScope(scoped(noteScope), scope({ characterId: "char-1", chatId: "chat-1" }))).toBe(true);
    });
  }
});

describe("a record that cannot be placed is shown, not hidden", () => {
  it("passes an absent note even when a scope is selected", () => {
    expect(noteInScope(undefined, scope({ chatId: "chat-1" }))).toBe(true);
    expect(noteInScope(undefined, scope({ characterId: "char-1" }))).toBe(true);
  });
});

describe("noteInScope reads both the singular and the plural id", () => {
  it("reads the singular alone", () => {
    expect(noteInScope(scoped({ chatId: "chat-1" }), scope({ chatId: "chat-1" }))).toBe(true);
    expect(noteInScope(scoped({ chatId: "chat-1" }), scope({ chatId: "chat-2" }))).toBe(false);
  });

  it("reads the plural alone", () => {
    expect(noteInScope(scoped({ chatIds: ["chat-1"] }), scope({ chatId: "chat-1" }))).toBe(true);
    expect(noteInScope(scoped({ chatIds: ["chat-1"] }), scope({ chatId: "chat-2" }))).toBe(false);
  });

  it("unions the two when both are written", () => {
    const note = scoped({ chatId: "chat-1", chatIds: ["chat-2"] });
    expect(noteInScope(note, scope({ chatId: "chat-1" }))).toBe(true);
    expect(noteInScope(note, scope({ chatId: "chat-2" }))).toBe(true);
    expect(noteInScope(note, scope({ chatId: "chat-3" }))).toBe(false);
  });

  it("ignores an empty-string singular rather than treating it as a declaration", () => {
    // An empty `chatId` must leave the note unscoped-on-chats, not scoped to
    // the id "": otherwise it would be excluded from every chat.
    expect(noteInScope(scoped({ chatId: "" }), scope({ chatId: "chat-1" }))).toBe(true);
    expect(noteInScope(scoped({ characterId: "" }), scope({ characterId: "char-1" }))).toBe(true);
  });

  it("filters non-strings and empty strings out of the plural", () => {
    const note = scoped({ chatIds: [null, 7, "", { id: "chat-1" }, "chat-1"] });
    expect(noteInScope(note, scope({ chatId: "chat-1" }))).toBe(true);
    expect(noteInScope(note, scope({ chatId: "chat-2" }))).toBe(false);
  });

  it("treats a non-object note scope as no declaration at all", () => {
    expect(noteInScope(scoped("chat-1"), scope({ chatId: "chat-1" }))).toBe(true);
    expect(noteInScope(scoped(null), scope({ chatId: "chat-2" }))).toBe(true);
  });

  it("reads characters the same way", () => {
    const note = scoped({ characterId: "char-1", characterIds: ["", 3, "char-2"] });
    expect(noteInScope(note, scope({ characterId: "char-1" }))).toBe(true);
    expect(noteInScope(note, scope({ characterId: "char-2" }))).toBe(true);
    expect(noteInScope(note, scope({ characterId: "char-3" }))).toBe(false);
  });
});

describe("chat is the narrower level and decides when set", () => {
  it("excludes on chats even though the note's characters would include it", () => {
    const note = scoped({ chatIds: ["chat-2"], characterIds: ["char-1"] });
    expect(noteInScope(note, scope({ characterId: "char-1", chatId: "chat-1" }))).toBe(false);
  });

  it("includes on chats even though the note's characters would exclude it", () => {
    // SUSPECT: a chat-level match overrides an explicit character-level
    // exclusion — this note says it is not available for char-1, yet it shows
    // while char-1 is selected. Defensible if a chat always cascades within
    // its own character (then the two lists cannot really disagree), but it
    // means malformed engine data fails open rather than closed.
    const note = scoped({ chatIds: ["chat-1"], characterIds: ["char-2"] });
    expect(noteInScope(note, scope({ characterId: "char-1", chatId: "chat-1" }))).toBe(true);
  });

  it("lets characters decide when the note declares no chats", () => {
    const note = scoped({ characterIds: ["char-1"] });
    expect(noteInScope(note, scope({ characterId: "char-1", chatId: "chat-1" }))).toBe(true);
    expect(noteInScope(note, scope({ characterId: "char-2", chatId: "chat-1" }))).toBe(false);
  });
});

describe("a level that is not declared does not exclude", () => {
  it("shows a character-only note while a chat is selected, because chats say nothing about it", () => {
    expect(noteInScope(scoped({ characterIds: ["char-1"] }), scope({ chatId: "chat-1" }))).toBe(true);
  });

  it("shows a chat-only note while a character is selected", () => {
    expect(noteInScope(scoped({ chatIds: ["chat-1"] }), scope({ characterId: "char-1" }))).toBe(true);
  });
});

describe("rowInScope", () => {
  const inChat = (id: string, chatId: string): Note => makeNote({ id, scope: { chatIds: [chatId] } });

  it("resolves the row's target through the byId map", () => {
    const target = inChat("note-target", "chat-1");
    const row: Row = makeRow({ targetId: target.id });
    const byId = new Map([[target.id, target]]);
    expect(rowInScope(row, byId, scope({ chatId: "chat-1" }))).toBe(true);
    expect(rowInScope(row, byId, scope({ chatId: "chat-2" }))).toBe(false);
  });

  it("falls back to the source note when the target is not stored yet", () => {
    // A row proposing a NEW memory has no target in the map, so it inherits
    // the scope of the source it was extracted from.
    const source = inChat("source-1", "chat-1");
    const row: Row = makeRow({ targetId: "not-stored-yet", sourceNoteId: source.id });
    const byId = new Map([[source.id, source]]);
    expect(rowInScope(row, byId, scope({ chatId: "chat-1" }))).toBe(true);
    expect(rowInScope(row, byId, scope({ chatId: "chat-2" }))).toBe(false);
  });

  it("prefers the target over the source when both are stored", () => {
    const target = inChat("note-target", "chat-1");
    const source = inChat("source-1", "chat-2");
    const byId = new Map([
      [target.id, target],
      [source.id, source],
    ]);
    const row: Row = makeRow({ targetId: target.id, sourceNoteId: source.id });
    expect(rowInScope(row, byId, scope({ chatId: "chat-1" }))).toBe(true);
    expect(rowInScope(row, byId, scope({ chatId: "chat-2" }))).toBe(false);
  });

  it("shows the row rather than throwing when neither id is in the map", () => {
    const row: Row = makeRow({ targetId: "missing", sourceNoteId: "also-missing" });
    expect(rowInScope(row, new Map(), scope({ chatId: "chat-1" }))).toBe(true);
  });

  it("short-circuits to true when nothing is selected, without touching the map", () => {
    const target = inChat("note-target", "chat-1");
    const row: Row = makeRow({ targetId: target.id });
    expect(rowInScope(row, new Map(), scope())).toBe(true);
  });
});

describe("setScope / setScopeCharacter", () => {
  it("writes the chat through to the store and to localStorage", () => {
    setScope("chat-1");
    expect(scopeChatId.get()).toBe("chat-1");
    expect(localStorage.getItem("mc-ltm-chat")).toBe("chat-1");
  });

  it("writes the character through to the store and to localStorage", () => {
    setScopeCharacter("char-1");
    expect(scopeCharacterId.get()).toBe("char-1");
    expect(localStorage.getItem("mc-ltm-character")).toBe("char-1");
  });

  it("clears the selected chat when a character is chosen", () => {
    // The chosen chat may not belong under the new character, so it cannot
    // stay selected — and the cleared value has to reach storage too, or a
    // reload would restore the stale chat.
    setScope("chat-1");
    setScopeCharacter("char-1");
    expect(scopeChatId.get()).toBe("");
    expect(localStorage.getItem("mc-ltm-chat")).toBe("");
  });

  it("keeps the selected chat when the character is cleared", () => {
    setScope("chat-1");
    setScopeCharacter("");
    expect(scopeChatId.get()).toBe("chat-1");
    expect(scopeCharacterId.get()).toBe("");
  });

  it("currentScope reads both stores without subscribing", () => {
    setScopeCharacter("char-1");
    setScope("chat-1");
    expect(currentScope()).toEqual({ characterId: "char-1", chatId: "chat-1" });
  });
});
