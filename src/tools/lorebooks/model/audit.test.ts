import { describe, expect, it } from "vitest";
import type { Entry } from "../api/schema";
import { percentile, tagStats, UNTAGGED } from "./audit";

const entry = (over: Partial<Entry> = {}): Entry => ({
  id: "entry_example",
  name: "Harbour",
  content: "",
  description: "",
  keys: [],
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
  tag: "",
  ...over,
});

describe("percentile", () => {
  it("answers zero for nothing to measure", () => {
    expect(percentile([], 0.9)).toBe(0);
  });

  it("reads the value at the index, sorting first", () => {
    expect(percentile([5, 1, 4, 2, 3, 10, 9, 8, 7, 6], 0.9)).toBe(10);
    expect(percentile([5, 1, 4, 2, 3, 10, 9, 8, 7, 6], 0.5)).toBe(6);
  });

  it("never runs off the end of the list", () => {
    expect(percentile([3], 1)).toBe(3);
  });
});

describe("tagStats", () => {
  it("files an untagged and a whitespace-only entry under the sentinel", () => {
    const stats = tagStats([entry({ id: "a" }), entry({ id: "b", tag: "  " })]);
    expect(stats).toHaveLength(1);
    expect(stats[0].tag).toBe(UNTAGGED);
    expect(stats[0].n).toBe(2);
  });

  it("counts tokens, constants and disabled entries per tag", () => {
    const stats = tagStats([
      entry({ id: "a", tag: "places", content: "12345678", constant: true }),
      entry({ id: "b", tag: "places", enabled: false }),
    ]);
    expect(stats[0]).toMatchObject({ tag: "places", n: 2, tokens: 2, constant: 1, disabled: 1, ids: ["a", "b"] });
  });

  it("sorts the busiest tag first", () => {
    const stats = tagStats([
      entry({ id: "a", tag: "people" }),
      entry({ id: "b", tag: "places" }),
      entry({ id: "c", tag: "places" }),
    ]);
    expect(stats.map((s) => s.tag)).toEqual(["places", "people"]);
  });
});
