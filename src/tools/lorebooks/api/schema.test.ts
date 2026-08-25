// Fixtures are real dev-engine responses with the contents replaced, so an
// "accepts" case failing means the schema drifted, not the fixture.

import { describe, expect, it } from "vitest";
import * as v from "valibot";
import { EntrySchema, LorebookSchema } from "./schema";

const ok = (schema: Parameters<typeof v.safeParse>[0], value: unknown) => v.safeParse(schema, value).success;

const book = () => ({
  id: "book_example",
  name: "Example",
  description: "",
  category: "world",
  scanDepth: 4,
  tokenBudget: 1000,
  entryLimit: 100,
  recursiveScanning: false,
  isGlobal: true,
  enabled: true,
  scope: { mode: "all", chatIds: [] },
  tags: [],
  createdAt: "2026-08-21T04:49:15.476Z",
  updatedAt: "2026-08-21T04:49:56.998Z",
});

const entry = () => ({
  id: "entry_example",
  lorebookId: "book_example",
  folderId: null,
  name: "Example",
  content: "A paragraph.",
  description: "",
  keys: ["example"],
  secondaryKeys: [],
  enabled: true,
  constant: false,
  selective: false,
  selectiveLogic: "and",
  probability: null,
  matchWholeWords: false,
  caseSensitive: false,
  useRegex: false,
  characterFilterMode: "any",
  position: 0,
  outletName: "",
  depth: 4,
  order: 100,
  role: "system",
  group: "",
  tag: "",
  relationships: {},
  dynamicState: {},
  activationConditions: [],
  preventRecursion: false,
  hasEmbedding: false,
  createdAt: "2026-08-21T04:49:15.476Z",
  updatedAt: "2026-08-21T04:49:56.998Z",
});

describe("LorebookSchema", () => {
  it("accepts a book in the shape the live engine sends", () => {
    expect(ok(LorebookSchema, book())).toBe(true);
  });

  it("keeps the fields it does not name, rather than stripping them", () => {
    expect(v.parse(LorebookSchema, book()).scope).toEqual({ mode: "all", chatIds: [] });
  });

  it("rejects a budget sent as a string", () => {
    expect(ok(LorebookSchema, { ...book(), tokenBudget: "1000" })).toBe(false);
  });

  it("rejects an enabled flag sent as a string", () => {
    expect(ok(LorebookSchema, { ...book(), enabled: "false" })).toBe(false);
  });

  it("rejects a book whose id is empty", () => {
    expect(ok(LorebookSchema, { ...book(), id: "" })).toBe(false);
  });
});

describe("EntrySchema", () => {
  it("accepts an entry in the shape the live engine sends", () => {
    expect(ok(EntrySchema, entry())).toBe(true);
  });

  it("accepts a field the engine has not shipped yet", () => {
    expect(ok(EntrySchema, { ...entry(), somethingNewUpstream: { nested: true } })).toBe(true);
  });

  it("accepts an entry that never reached the embedding swap", () => {
    const { hasEmbedding, ...rest } = entry();
    void hasEmbedding;
    expect(ok(EntrySchema, rest)).toBe(true);
  });

  it("rejects a flag sent as a string, which no truthiness test would catch", () => {
    for (const flag of ["enabled", "constant", "selective", "useRegex", "matchWholeWords", "caseSensitive"]) {
      expect(ok(EntrySchema, { ...entry(), [flag]: "false" })).toBe(false);
    }
  });

  it("rejects a number sent as a string", () => {
    for (const field of ["order", "position", "depth"]) {
      expect(ok(EntrySchema, { ...entry(), [field]: "0" })).toBe(false);
    }
  });

  it("rejects a selective logic the vendored matcher does not implement", () => {
    expect(ok(EntrySchema, { ...entry(), selectiveLogic: "xor" })).toBe(false);
  });

  it("rejects keys sent as one string rather than a list", () => {
    expect(ok(EntrySchema, { ...entry(), keys: "example" })).toBe(false);
  });

  it("rejects an entry whose id is empty", () => {
    expect(ok(EntrySchema, { ...entry(), id: "" })).toBe(false);
  });
});
