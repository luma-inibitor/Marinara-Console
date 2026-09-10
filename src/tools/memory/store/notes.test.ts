// The write path, at the seam where a note stops being a payload and becomes a
// stored memory.
//
// The shipped defect here: the engine's write routes answer with
// `{note, rebuild}`, the endpoint declared a bare `Note`, and the envelope went
// into the map under the key `undefined`, where a screen reading it crashed
// long after the write. The endpoint must unwrap, and what it unwraps must be
// a memory — which is now the schema's job, asserted in api/schema.test.ts.

import { beforeEach, describe, expect, it, vi } from "vitest";
import { WireMismatchError } from "../../../shell/wire";
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
      opts?.method === "PATCH" ? Promise.resolve({ note: NOTE, rebuild: {} }) : Promise.resolve([]),
    );
    await saveNoteSections("char_watson", { bio: { text: "hello" } });
    expect([...notesById.get().keys()]).toEqual(["char_watson"]);
    expect(notesById.get().get("char_watson")).toEqual(NOTE);
  });

  it.each([
    ["a bare note, without the envelope", NOTE],
    ["an envelope whose note has no id", { note: { ...NOTE, id: "" }, rebuild: {} }],
  ])("throws on %s rather than storing it", async (_label, payload) => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    request.mockResolvedValue(payload);
    await expect(patchNote("char_watson", { status: "active" })).rejects.toBeInstanceOf(WireMismatchError);
    expect(notesById.get().size).toBe(0);
  });
});

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

  it("leaves the store alone when the reply carries no notes at all", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    request.mockResolvedValue({ archived: true, note: SOURCE, rebuild: {} });
    await expect(archiveNoteWithExtracted("source_x")).rejects.toBeInstanceOf(WireMismatchError);
    expect(notesById.get().size).toBe(0);
  });

  // One bad note in the cascade fails the whole reply, so the vault never shows
  // half a cascade archived while the engine archived all of it.
  it("stores nothing when one note in the cascade does not parse", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    request.mockResolvedValue({ archived: true, note: SOURCE, notes: [SOURCE, { ...DERIVED, id: "" }], rebuild: {} });
    await expect(archiveNoteWithExtracted("source_x")).rejects.toBeInstanceOf(WireMismatchError);
    expect(notesById.get().size).toBe(0);
  });
});

describe("putNote", () => {
  it("stores a memory under its own id", () => {
    putNote({ ...NOTE });
    expect(notesById.get().get("char_watson")).toBeTruthy();
  });
});
