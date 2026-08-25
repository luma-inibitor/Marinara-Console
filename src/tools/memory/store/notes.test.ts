// The write path, at the seam where a note stops being a payload and becomes a
// stored memory.
//
// Both cases here are the same shipped defect seen from two sides: the engine's
// write routes answer with `{note, rebuild}`, the endpoint declared a bare
// `Note`, and the envelope went into the map under the key `undefined`, where a
// screen reading it crashed long after the write. So: the endpoint must unwrap,
// and the map must refuse anything that is not a memory.

import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Note } from "../api/types";

const request = vi.fn();
vi.mock("../../../shell/api", () => ({ api: (path: string, opts?: unknown) => request(path, opts) }));

const { patchNote } = await import("../api/notes");
const { archiveNoteWithExtracted, notesById, putNote, saveNoteSections } = await import("./notes");

const NOTE: Note = { id: "char_watson", type: "character", status: "active", modes: [], links: [], sections: {} };

beforeEach(() => {
  request.mockReset();
  notesById.set(new Map());
});

describe("patchNote", () => {
  it("returns the note out of the envelope, not the envelope", async () => {
    request.mockResolvedValue({ note: NOTE, rebuild: { status: "complete" } });
    expect(await patchNote("char_watson", { status: "active" })).toEqual(NOTE);
  });

  it("keys the saved memory by its own id when the store writes it", async () => {
    request.mockImplementation((_path: string, opts?: { method?: string }) =>
      opts?.method === "PATCH" ? Promise.resolve({ note: NOTE, rebuild: {} }) : Promise.resolve([]));
    await saveNoteSections("char_watson", { bio: { text: "hello" } });
    expect([...notesById.get().keys()]).toEqual(["char_watson"]);
    expect(notesById.get().get("char_watson")).toEqual(NOTE);
  });
});

// The route named DELETE archives; nothing it touches leaves the store. A
// version of this that dropped the target left the memories extracted from it
// sitting in the map still reading "active", which is the one status the write
// had just made false.
describe("archiveNoteWithExtracted", () => {
  const SOURCE: Note = { id: "source_x", type: "source", status: "archived", modes: [], links: [], sections: {} };
  const DERIVED: Note = { ...NOTE, id: "world_x", type: "world", status: "archived" };

  it("keeps every note the cascade archived, carrying its new status", async () => {
    putNote({ ...SOURCE, status: "active" });
    putNote({ ...DERIVED, status: "active" });
    request.mockResolvedValue({ archived: true, note: SOURCE, notes: [SOURCE, DERIVED], rebuild: {} });

    const archived = await archiveNoteWithExtracted("source_x");

    expect(archived).toEqual([SOURCE, DERIVED]);
    expect([...notesById.get().keys()].sort()).toEqual(["source_x", "world_x"]);
    expect([...notesById.get().values()].map((n) => n.status)).toEqual(["archived", "archived"]);
  });

  it("leaves the store alone when the reply carries no notes", async () => {
    request.mockResolvedValue({ archived: true, note: SOURCE, rebuild: {} });
    expect(await archiveNoteWithExtracted("source_x")).toEqual([]);
    expect(notesById.get().size).toBe(0);
  });
});

describe("putNote", () => {
  it("stores a memory that has an id", () => {
    putNote({ ...NOTE });
    expect(notesById.get().get("char_watson")).toBeTruthy();
  });

  it.each([
    ["no id", {}],
    ["an empty id", { id: "" }],
    ["a non-string id", { id: 7 }],
    ["an envelope instead of a note", { note: NOTE, rebuild: {} }],
  ])("refuses a record with %s, and leaves the map untouched", (_label, record) => {
    expect(() => putNote(record as never)).toThrow();
    expect(notesById.get().size).toBe(0);
  });
});
