// Characterization tests for the preview zone's diff primitives.
//
// These pin what `lineDiff` and `wordEmphasis` do today, exactly, so a refactor
// can prove it changed nothing. Where the current behavior looks wrong it is
// still pinned as-is and flagged `// SUSPECT:` — nothing here is a spec.
//
// Two properties downstream rendering depends on are asserted directly rather
// than inferred: the op ORDER within a replacement, and the fact that a moved
// line is reported as an unrelated del/add pair. Both are the kind of thing a
// well-meaning rewrite "improves" without realizing the renderer reads them.

import { describe, expect, it } from "vitest";

import { type DiffOp, lineDiff, wordEmphasis } from "./diff";

const ctx = (text: string): DiffOp => ({ t: "ctx", text });
const del = (text: string): DiffOp => ({ t: "del", text });
const add = (text: string): DiffOp => ({ t: "add", text });

describe("lineDiff", () => {
  it("reports every line as ctx when the inputs are identical", () => {
    expect(lineDiff(["a", "b", "c"], ["a", "b", "c"])).toEqual([ctx("a"), ctx("b"), ctx("c")]);
  });

  it("returns no ops when both sides are empty", () => {
    expect(lineDiff([], [])).toEqual([]);
  });

  it("reports a pure insert when the old side is empty", () => {
    expect(lineDiff([], ["a", "b"])).toEqual([add("a"), add("b")]);
  });

  it("reports a pure delete when the new side is empty", () => {
    expect(lineDiff(["a", "b"], [])).toEqual([del("a"), del("b")]);
  });

  it("reports an insertion in the middle as a single add between ctx lines", () => {
    expect(lineDiff(["a", "c"], ["a", "b", "c"])).toEqual([ctx("a"), add("b"), ctx("c")]);
  });

  it("reports a deletion in the middle as a single del between ctx lines", () => {
    expect(lineDiff(["a", "b", "c"], ["a", "c"])).toEqual([ctx("a"), del("b"), ctx("c")]);
  });

  // The tie-break `dp[i + 1][j] >= dp[i][j + 1]` favors advancing the OLD side
  // first, so a replaced line always emits its del before its add. The renderer
  // pairs adjacent del/add ops for word emphasis and relies on that order.
  it("emits del BEFORE add for a replaced line in the middle", () => {
    const ops = lineDiff(["x", "b", "z"], ["x", "c", "z"]);
    expect(ops).toEqual([ctx("x"), del("b"), add("c"), ctx("z")]);
    expect(ops.map((o) => o.t)).toEqual(["ctx", "del", "add", "ctx"]);
  });

  // Deliberately NOT a move detector. A line that moved is torn into a delete at
  // its old position and an insert at its new one, with no link between them.
  // Anyone tempted to "fix" this into a move op is changing behavior, not fixing
  // a bug — this test exists to make that a conscious decision.
  it("reports a moved line as a separate del and add, never as a move", () => {
    const ops = lineDiff(["a", "b", "c"], ["b", "c", "a"]);
    expect(ops).toEqual([del("a"), ctx("b"), ctx("c"), add("a")]);
  });

  describe("repeated identical lines", () => {
    // LCS matches by value, so with duplicates it is free to pick which copy is
    // "the same one". These pin which copy today's traceback settles on.
    it("keeps the first duplicate and deletes the later copy along with its neighbor", () => {
      expect(lineDiff(["a", "x", "a", "y", "a"], ["a", "y", "a"])).toEqual([
        ctx("a"),
        del("x"),
        del("a"),
        ctx("y"),
        ctx("a"),
      ]);
    });

    it("appends the extra copy at the end when a duplicate run grows", () => {
      expect(lineDiff(["a", "a"], ["a", "a", "a"])).toEqual([ctx("a"), ctx("a"), add("a")]);
    });

    it("deletes the trailing duplicate rather than the leading one", () => {
      expect(lineDiff(["one", "dup", "two", "dup", "three"], ["one", "dup", "three"])).toEqual([
        ctx("one"),
        ctx("dup"),
        del("two"),
        del("dup"),
        ctx("three"),
      ]);
    });
  });
});

describe("wordEmphasis", () => {
  // Splitting is `/(\s+)/`, which keeps the separators as tokens and compares
  // whole whitespace-delimited words. A shared character run that stops mid-word
  // therefore contributes nothing to the prefix — see the "config" case below.
  it("splits on whole words, so a prefix ending mid-word yields no common pre", () => {
    expect(wordEmphasis("configuration value", "config value")).toEqual({
      pre: "",
      delMid: "configuration",
      addMid: "config",
      post: " value",
    });
  });

  it("returns null when the lines share no leading or trailing words", () => {
    expect(wordEmphasis("alpha beta", "gamma delta")).toBeNull();
  });

  // SUSPECT: identical inputs do NOT return null. The whole string becomes `pre`
  // and both mids come back empty, so the caller gets a "changed line" record
  // describing no change at all. Callers that treat a non-null result as proof
  // something differs would render an empty del/add pair. Pinned as-is.
  it("returns a whole-string pre with empty mids for identical inputs, not null", () => {
    expect(wordEmphasis("the quick fox", "the quick fox")).toEqual({
      pre: "the quick fox",
      delMid: "",
      addMid: "",
      post: "",
    });
  });

  // SUSPECT: same shape for two empty strings — the `< min(...) * 0.3` guard
  // compares 0 < 0, which is false, so the null path is unreachable here.
  it("returns an all-empty record for two empty strings, not null", () => {
    expect(wordEmphasis("", "")).toEqual({ pre: "", delMid: "", addMid: "", post: "" });
  });

  type Case = {
    name: string;
    del: string;
    add: string;
    want: { pre: string; delMid: string; addMid: string; post: string };
  };

  const cases: Case[] = [
    {
      name: "a one-word change in the middle",
      del: "alpha beta gamma",
      add: "alpha delta gamma",
      want: { pre: "alpha ", delMid: "beta", addMid: "delta", post: " gamma" },
    },
    {
      name: "a change at the very start (empty pre)",
      del: "alpha beta gamma",
      add: "omega beta gamma",
      want: { pre: "", delMid: "alpha", addMid: "omega", post: " beta gamma" },
    },
    {
      name: "a change at the very end (empty post)",
      del: "alpha beta gamma",
      add: "alpha beta omega",
      want: { pre: "alpha beta ", delMid: "gamma", addMid: "omega", post: "" },
    },
    {
      // SUSPECT: the inserted word carries a TRAILING space ("quick ") while
      // `post` loses its leading one ("fox", not " fox"). The suffix scan stops
      // at the shorter side's remaining token count, so the separator lands
      // inside the emphasized span instead of outside it. Compare the middle
      // case above, where post keeps its leading space. Rendered with a
      // background highlight this shows a trailing blob of color.
      name: "a pure insertion (empty delMid)",
      del: "the fox",
      add: "the quick fox",
      want: { pre: "the ", delMid: "", addMid: "quick ", post: "fox" },
    },
    {
      // SUSPECT: the mirror of the case above — the deleted span is "quick "
      // with its trailing space, and `post` is "fox" without a leading one.
      name: "a pure deletion (empty addMid)",
      del: "the quick fox",
      add: "the fox",
      want: { pre: "the ", delMid: "quick ", addMid: "", post: "fox" },
    },
    {
      name: "a word replaced by a longer word sharing a character prefix",
      del: "the quickest fox",
      add: "the quick fox",
      want: { pre: "the ", delMid: "quickest", addMid: "quick", post: " fox" },
    },
  ];

  it.each(cases)("emphasizes $name", ({ del: d, add: a, want }) => {
    expect(wordEmphasis(d, a)).toEqual(want);
  });
});
