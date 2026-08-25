import { describe, expect, it } from "vitest";
import type { Entry } from "../api/schema";
import { entryTokens, matchesQuery, statusOf } from "./entry";

const entry = (over: Partial<Entry> = {}): Entry => ({
  id: "entry_example",
  name: "Harbour",
  content: "The harbour wall.",
  description: "A place.",
  keys: ["harbour"],
  secondaryKeys: [],
  enabled: true,
  constant: false,
  selective: false,
  selectiveLogic: "and",
  useRegex: false,
  matchWholeWords: false,
  caseSensitive: false,
  position: 0,
  outletName: "",
  depth: 4,
  order: 100,
  tag: "places",
  ...over,
});

describe("statusOf", () => {
  it("reads disabled ahead of every other flag", () => {
    expect(statusOf(entry({ enabled: false, constant: true, selective: true }))).toBe("disabled");
  });

  it("reads constant ahead of selective", () => {
    expect(statusOf(entry({ constant: true, selective: true }))).toBe("constant");
  });

  it("reads selective when only that flag is set", () => {
    expect(statusOf(entry({ selective: true }))).toBe("selective");
  });

  it("reads a plain enabled entry as normal", () => {
    expect(statusOf(entry())).toBe("normal");
  });
});

describe("entryTokens", () => {
  it("counts the content and nothing else", () => {
    expect(entryTokens(entry({ content: "12345678", description: "ignored" }))).toBe(2);
  });

  it("counts an empty entry as nothing", () => {
    expect(entryTokens(entry({ content: "" }))).toBe(0);
  });
});

describe("matchesQuery", () => {
  it("matches everything on an empty query", () => {
    expect(matchesQuery(entry(), "   ")).toBe(true);
  });

  it("matches the name, content, description, a key and the tag", () => {
    for (const q of ["harbour", "wall", "a place", "HARBOUR", "places"]) {
      expect(matchesQuery(entry(), q)).toBe(true);
    }
  });

  it("does not match a word in none of those fields", () => {
    expect(matchesQuery(entry(), "lighthouse")).toBe(false);
  });
});
