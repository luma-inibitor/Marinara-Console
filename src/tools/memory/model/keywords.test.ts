import { describe, expect, it } from "vitest";
import { KEYWORD_CAP } from "./caps";
import { effectiveKeywords, manualKeywords, splitKeywords } from "./keywords";

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
