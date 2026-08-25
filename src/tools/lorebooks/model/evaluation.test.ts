import { describe, expect, it } from "vitest";
import type { Entry } from "../api/schema";
import { evaluate } from "./evaluation";

const entry = (over: Partial<Entry> = {}): Entry => ({
  id: "entry_example",
  name: "Harbour",
  content: "The harbour wall.",
  description: "",
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
  tag: "",
  ...over,
});

describe("evaluate", () => {
  it("reports untested rather than not firing when there is no probe", () => {
    expect(evaluate(entry(), "   ")).toEqual({ fires: false, hits: [], tested: false });
  });

  it("never fires a disabled entry, whatever the probe says", () => {
    expect(evaluate(entry({ enabled: false }), "the harbour")).toEqual({ fires: false, hits: [], tested: true });
  });

  it("fires a constant entry without matching anything", () => {
    expect(evaluate(entry({ constant: true }), "nothing in common")).toEqual({ fires: true, hits: [], tested: true });
  });

  it("returns the keys that matched", () => {
    expect(evaluate(entry(), "down at the harbour")).toEqual({ fires: true, hits: ["harbour"], tested: true });
  });

  it("does not fire when no primary key matches", () => {
    expect(evaluate(entry(), "up on the hill")).toEqual({ fires: false, hits: [], tested: true });
  });

  it("holds a selective entry back until a secondary key matches too", () => {
    const selective = entry({ selective: true, secondaryKeys: ["storm"] });
    expect(evaluate(selective, "down at the harbour").fires).toBe(false);
    expect(evaluate(selective, "a storm at the harbour").fires).toBe(true);
  });
});
