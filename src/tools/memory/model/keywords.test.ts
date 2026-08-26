import { describe, expect, it } from "vitest";
import { INDEXED_KEYWORD_CAP, KEYWORD_CAP } from "./caps";
import {
  effectiveKeywords, ignoredKeywordCount, indexedKeywords, manualKeywords, splitKeywords,
} from "./keywords";

describe("splitKeywords", () => {
  it("reads a note with no manualKeywords array as all-manual", () => {
    expect(splitKeywords({ keywords: ["harbour", "cargo"] })).toEqual({
      derived: [], manual: ["harbour", "cargo"], suppressed: [],
    });
  });

  it("reads an empty manualKeywords array as manual-empty, not as legacy", () => {
    expect(splitKeywords({ keywords: ["harbour"], manualKeywords: [] })).toEqual({
      derived: ["harbour"], manual: [], suppressed: [],
    });
  });

  it("drops blank and case-duplicate entries within each list", () => {
    expect(splitKeywords({ keywords: [" Harbour ", "harbour", "  "], manualKeywords: ["Cargo", "cargo"] })).toEqual({
      derived: ["Harbour"], manual: ["Cargo"], suppressed: [],
    });
  });
});

describe("manualKeywords", () => {
  it("counts only what a person added once the arrays are split", () => {
    const note = { keywords: Array.from({ length: 30 }, (_, i) => `d${i}`), manualKeywords: ["mine"] };
    expect(manualKeywords(note)).toEqual(["mine"]);
  });

  it("counts the whole list on a note written before the split", () => {
    expect(manualKeywords({ keywords: ["harbour", "cargo"] })).toEqual(["harbour", "cargo"]);
  });

  it("is empty when the note carries no keywords at all", () => {
    expect(manualKeywords({})).toEqual([]);
  });
});

describe("effectiveKeywords", () => {
  it("merges derived and manual", () => {
    expect(effectiveKeywords({ keywords: ["harbour"], manualKeywords: ["cargo"] })).toEqual(["harbour", "cargo"]);
  });

  it("does not repeat a keyword present in both lists", () => {
    expect(effectiveKeywords({ keywords: ["Harbour"], manualKeywords: ["harbour"] })).toEqual(["Harbour"]);
  });

  it("removes the derived keywords a person suppressed", () => {
    const note = { keywords: ["harbour", "fog"], manualKeywords: ["cargo"], suppressedKeywords: ["Fog"] };
    expect(effectiveKeywords(note)).toEqual(["harbour", "cargo"]);
  });

  it("can exceed the manual cap, because each array is capped separately", () => {
    const note = {
      keywords: Array.from({ length: 30 }, (_, i) => `d${i}`),
      manualKeywords: Array.from({ length: 30 }, (_, i) => `m${i}`),
    };
    expect(effectiveKeywords(note)).toHaveLength(60);
    expect(manualKeywords(note)).toHaveLength(30);
  });
});

describe("the two counts a keyword rail and its cap tally read", () => {
  it("leaves the tally at zero on a note the engine keyworded by itself", () => {
    const note = { keywords: Array.from({ length: KEYWORD_CAP }, (_, i) => `d${i}`), manualKeywords: [] };
    expect(effectiveKeywords(note)).toHaveLength(KEYWORD_CAP);
    expect(manualKeywords(note)).toHaveLength(0);
  });

  it("counts a suppressed keyword out of the rail without touching the tally", () => {
    const note = { keywords: ["harbour", "fog"], manualKeywords: ["cargo"], suppressedKeywords: ["fog"] };
    expect(effectiveKeywords(note)).toHaveLength(2);
    expect(manualKeywords(note)).toHaveLength(1);
  });

  it("has the tally equal the rail on a note written before the split", () => {
    const note = { keywords: ["harbour", "cargo"] };
    expect(manualKeywords(note)).toEqual(effectiveKeywords(note));
  });
});

describe("indexedKeywords", () => {
  it("returns the whole merged list when it fits under the index cap", () => {
    const note = { keywords: ["harbour", "fog"], manualKeywords: ["cargo"] };
    expect(indexedKeywords(note)).toEqual(["harbour", "fog", "cargo"]);
    expect(ignoredKeywordCount(note)).toBe(0);
  });

  it("returns everything when the merged list sits exactly on the cap", () => {
    const note = {
      keywords: Array.from({ length: INDEXED_KEYWORD_CAP - 4 }, (_, i) => `d${i}`),
      manualKeywords: Array.from({ length: 4 }, (_, i) => `m${i}`),
    };
    expect(indexedKeywords(note)).toEqual(effectiveKeywords(note));
    expect(ignoredKeywordCount(note)).toBe(0);
  });

  it("drops the manual keywords past the cap, keeping derived ones first", () => {
    const note = {
      keywords: Array.from({ length: INDEXED_KEYWORD_CAP }, (_, i) => `d${i}`),
      manualKeywords: Array.from({ length: 5 }, (_, i) => `m${i}`),
    };
    const indexed = indexedKeywords(note);
    expect(indexed).toHaveLength(INDEXED_KEYWORD_CAP);
    expect(indexed).toEqual(Array.from({ length: INDEXED_KEYWORD_CAP }, (_, i) => `d${i}`));
    expect(indexed.some((k) => k.startsWith("m"))).toBe(false);
    expect(ignoredKeywordCount(note)).toBe(5);
  });

  it("indexes manual keywords only in the slots derived ones leave over", () => {
    const note = {
      keywords: Array.from({ length: INDEXED_KEYWORD_CAP - 2 }, (_, i) => `d${i}`),
      manualKeywords: ["first", "second", "third", "fourth"],
    };
    const indexed = indexedKeywords(note);
    expect(indexed.slice(-2)).toEqual(["first", "second"]);
    expect(indexed).not.toContain("third");
    expect(ignoredKeywordCount(note)).toBe(2);
  });

  it("counts suppressed keywords out before the cap applies", () => {
    const keywords = Array.from({ length: INDEXED_KEYWORD_CAP }, (_, i) => `d${i}`);
    const note = { keywords, manualKeywords: ["mine"], suppressedKeywords: ["d0", "d1"] };
    expect(indexedKeywords(note)).toContain("mine");
    expect(ignoredKeywordCount(note)).toBe(0);
  });

  it("indexes a pre-split note's whole list, which the engine reads as manual", () => {
    const note = { keywords: Array.from({ length: INDEXED_KEYWORD_CAP + 3 }, (_, i) => `k${i}`) };
    expect(manualKeywords(note)).toHaveLength(INDEXED_KEYWORD_CAP + 3);
    expect(indexedKeywords(note)).toHaveLength(INDEXED_KEYWORD_CAP);
    expect(ignoredKeywordCount(note)).toBe(3);
  });
});
