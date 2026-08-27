// Characterization of derived.ts: shingles, jaccard, vaultLines, computeDerived,
// dedupeLines. These pin what the code does today so a refactor can prove it
// changed nothing — including the parts that look wrong. Anything that looks
// like a defect is pinned as-is and marked `// SUSPECT:` rather than fixed.
//
// Similarity numbers are built from `words(n)` runs rather than prose so the
// arithmetic is checkable by eye: a run of n distinct words has exactly
// n - 3 four-word shingles, and a prefix run's shingles are a strict subset of
// the longer run's, so jaccard is (prefix shingles) / (longer shingles).

import { beforeEach, describe, expect, it } from "vitest";
import {
  DUPLICATE_THRESHOLD,
  computeDerived,
  dedupeLines,
  jaccard,
  normalizeLine,
  shingles,
  vaultLines,
} from "./derived";
import type { Row } from "./review";
import { makeNote, makeRow, resetIds, section } from "../test/factories";

/** `w1 w2 … wn` — n distinct words, so exactly n - 3 default-size shingles. */
function words(n: number): string {
  return Array.from({ length: n }, (_, i) => `w${i + 1}`).join(" ");
}

beforeEach(resetIds);

describe("shingles", () => {
  it("defaults to a 4-word window", () => {
    expect(shingles("the quick brown fox jumps")).toEqual(new Set(["the quick brown fox", "quick brown fox jumps"]));
  });

  it("honours an explicit window size", () => {
    expect(shingles("the quick brown fox", 2)).toEqual(new Set(["the quick", "quick brown", "brown fox"]));
  });

  it("returns a Set, so a repeated phrase collapses to one entry", () => {
    const out = shingles("alpha beta gamma delta alpha beta gamma delta");
    expect(out).toBeInstanceOf(Set);
    // 5 windows over 8 words, but "alpha beta gamma delta" occurs twice.
    expect(out.size).toBe(4);
    expect(out.has("alpha beta gamma delta")).toBe(true);
  });

  describe("text shorter than the window", () => {
    // SUSPECT: below the window size the function abandons shingling entirely
    // and emits the whole text as a single pseudo-shingle. That token can only
    // ever match another text with the identical full word run, so a short line
    // scores 0 against every long one — see the jaccard test below. vaultLines
    // admits lines down to 12 characters, which is comfortably short enough to
    // be under four words, so this path is reachable with real vault content.
    it("emits the whole text as one shingle", () => {
      expect(shingles("alpha beta gamma")).toEqual(new Set(["alpha beta gamma"]));
    });

    it("emits one shingle for a single word", () => {
      expect(shingles("alpha")).toEqual(new Set(["alpha"]));
    });

    it("scores 0 against a longer text that contains it verbatim", () => {
      const short = shingles("elaborate persuasive rhetoric");
      const long = shingles("elaborate persuasive rhetoric fills the room");
      expect(jaccard(short, long)).toBe(0);
    });
  });

  it("returns an empty set for empty and whitespace-only text", () => {
    expect(shingles("")).toEqual(new Set());
    expect(shingles("   \n\t ")).toEqual(new Set());
  });

  describe("normalization", () => {
    it("lowercases", () => {
      expect(shingles("The Quick Brown Fox")).toEqual(new Set(["the quick brown fox"]));
    });

    it("replaces punctuation with a space rather than deleting it", () => {
      // Not a no-op substitution: the space means "brown-fox" is two words, so
      // a 4-word window lands somewhere different than it would if the hyphen
      // were merely stripped.
      expect(shingles("the quick brown-fox jumps")).toEqual(new Set(["the quick brown fox", "quick brown fox jumps"]));
    });

    it("splits contractions and possessives into two words", () => {
      // Follows from punctuation becoming a space: "don't" is "don" + "t".
      expect(shingles("don't stop believing", 2)).toEqual(new Set(["don t", "t stop", "stop believing"]));
    });

    it("collapses runs of whitespace and ignores leading/trailing whitespace", () => {
      expect(shingles("  the   quick \n brown\tfox  ")).toEqual(new Set(["the quick brown fox"]));
    });

    it("drops punctuation-only tokens instead of emitting empty words", () => {
      expect(shingles("alpha -- beta ... gamma !! delta")).toEqual(new Set(["alpha beta gamma delta"]));
    });
  });
});

describe("jaccard", () => {
  it("scores identical sets 1", () => {
    expect(jaccard(new Set(["a", "b", "c"]), new Set(["a", "b", "c"]))).toBe(1);
  });

  it("scores disjoint sets 0", () => {
    expect(jaccard(new Set(["a", "b"]), new Set(["c", "d"]))).toBe(0);
  });

  it("scores partial overlap as intersection / union", () => {
    // {a,b,c} ∩ {b,c,d} = 2; union = 3 + 3 - 2 = 4; 2/4 = 0.5.
    expect(jaccard(new Set(["a", "b", "c"]), new Set(["b", "c", "d"]))).toBe(0.5);
  });

  it("is symmetric regardless of which set is larger", () => {
    const a = new Set(["a", "b", "c", "d"]);
    const b = new Set(["c", "d"]);
    // {c,d} ⊂ {a,b,c,d}: 2 / (4 + 2 - 2) = 2/4 = 0.5.
    expect(jaccard(a, b)).toBe(0.5);
    expect(jaccard(b, a)).toBe(0.5);
  });

  it("returns 0 — not NaN — for two empty sets", () => {
    // The guard on `!a.size || !b.size` runs before the division, so the
    // 0/0 case never happens. Two empty sets are trivially identical but score
    // 0, which is the safe direction: every caller compares against a
    // threshold, and 0 fails those the way NaN would, without NaN's habit of
    // making both `>=` and `<` false at once.
    const out = jaccard(new Set(), new Set());
    expect(out).toBe(0);
    expect(Number.isNaN(out)).toBe(false);
  });

  it("returns 0 when exactly one set is empty", () => {
    expect(jaccard(new Set(), new Set(["a"]))).toBe(0);
    expect(jaccard(new Set(["a"]), new Set())).toBe(0);
  });
});

describe("vaultLines", () => {
  it("produces noteId, sectionKey, line and pre-computed shingles per line", () => {
    const note = makeNote({ id: "n1", sections: { habits: section("she keeps the harbor bell wound") } });
    const [line, ...rest] = vaultLines([note]);
    expect(rest).toEqual([]);
    expect(line.noteId).toBe("n1");
    expect(line.sectionKey).toBe("habits");
    expect(line.line).toBe("she keeps the harbor bell wound");
    expect(line.sh).toEqual(shingles("she keeps the harbor bell wound"));
  });

  it("excludes source notes entirely", () => {
    const source = makeNote({ type: "source", sections: { body: section("this line is plenty long enough") } });
    expect(vaultLines([source])).toEqual([]);
  });

  it("returns nothing for a note with no sections", () => {
    expect(vaultLines([makeNote({ sections: {} })])).toEqual([]);
  });

  it("keeps every section of a note, tagged with its own key", () => {
    const note = makeNote({
      id: "n2",
      sections: {
        first: section("the first section line is long"),
        second: section("the second section line is long"),
      },
    });
    expect(vaultLines([note]).map((l) => [l.sectionKey, l.line])).toEqual([
      ["first", "the first section line is long"],
      ["second", "the second section line is long"],
    ]);
  });

  it("splits section text on runs of newlines, so blank lines yield no entries", () => {
    const note = makeNote({
      sections: { s: section("the first line of the section\n\n\nthe second line of the section") },
    });
    expect(vaultLines([note]).map((l) => l.line)).toEqual([
      "the first line of the section",
      "the second line of the section",
    ]);
  });

  it("strips a leading bullet marker, then trims", () => {
    const note = makeNote({
      sections: { s: section("- dashed line of sufficient length\n•  bulleted line of length") },
    });
    expect(vaultLines([note]).map((l) => l.line)).toEqual([
      "dashed line of sufficient length",
      "bulleted line of length",
    ]);
  });

  it("strips the marker from an indented bullet", () => {
    // The strip is anchored with ^, so it only reaches the marker because
    // normalizeLine trims first. Getting that order wrong left the marker in
    // `line`, which is the string the restates banner quotes back, and it
    // counted toward the 12-character floor.
    const note = makeNote({ sections: { s: section(" *  starred line of length") } });
    expect(vaultLines([note]).map((l) => l.line)).toEqual(["starred line of length"]);
  });

  it("normalizes the same way dedupeLines does", () => {
    // The two used to disagree on exactly this input. They share normalizeLine
    // now, so the assertion is that neither can drift again.
    const indented = " *  a line long enough to clear both floors";
    const note = makeNote({ sections: { s: section(indented) } });
    expect(vaultLines([note])[0].line).toBe(normalizeLine(indented));
  });

  it("drops lines shorter than 12 characters, measured after stripping", () => {
    const note = makeNote({
      sections: { s: section(["exactly 12ch", "short one", "- 11 chars!", "a line that is clearly long"].join("\n")) },
    });
    // "exactly 12ch" is 12 characters and survives; "- 11 chars!" is 11 after
    // the bullet is stripped and does not.
    expect(vaultLines([note]).map((l) => l.line)).toEqual(["exactly 12ch", "a line that is clearly long"]);
  });

  it("tolerates a section whose text is missing", () => {
    const note = makeNote({ sections: { s: { text: undefined as unknown as string } } });
    expect(vaultLines([note])).toEqual([]);
  });

  it("walks notes in order", () => {
    const a = makeNote({ id: "a", sections: { s: section("first note first line here") } });
    const b = makeNote({ id: "b", sections: { s: section("second note first line here") } });
    expect(vaultLines([a, b]).map((l) => l.noteId)).toEqual(["a", "b"]);
  });
});

describe("computeDerived", () => {
  it("returns undefined and mutates the rows it was given", () => {
    const row = makeRow({ text: words(8) });
    const rows = [row];
    const out = computeDerived(rows, []);
    expect(out).toBeUndefined();
    // Same array, same object identity — nothing is copied.
    expect(rows[0]).toBe(row);
    expect(row.sh).toEqual(shingles(words(8)));
  });

  it("sets restates and duplicateOf to null — not absent — when nothing matches", () => {
    // Callers may branch on `in` or on `=== null`; those differ, and this is null.
    const row = makeRow({ text: "nothing here resembles anything stored" });
    computeDerived([row], vaultLines([makeNote({ sections: { s: section("wholly unrelated stored sentence") } })]));
    expect(row.restates).toBeNull();
    expect(row.duplicateOf).toBeNull();
    expect("restates" in row).toBe(true);
    expect("duplicateOf" in row).toBe(true);
  });

  it("flags a row that restates a stored line, naming the line and its note", () => {
    const text = "the harbor bell is wound every morning without fail";
    const row = makeRow({ text });
    const lines = vaultLines([makeNote({ id: "n9", sections: { habits: section(text) } })]);
    computeDerived([row], lines);
    expect(row.restates).toEqual({ score: 1, line: text, noteId: "n9" });
  });

  it("keeps the highest-scoring stored line when several clear the threshold", () => {
    const text = words(23);
    const row = makeRow({ text });
    const lines = vaultLines([
      makeNote({ id: "partial", sections: { s: section(words(12)) } }),
      makeNote({ id: "exact", sections: { s: section(text) } }),
    ]);
    computeDerived([row], lines);
    expect(row.restates?.noteId).toBe("exact");
    expect(row.restates?.score).toBe(1);
  });

  describe("the restates threshold of 0.45", () => {
    // words(23) has 20 shingles; words(12) has 9, all of them a subset.
    // 9 / (20 + 9 - 9) = 9/20 = 0.45, exactly on the line.
    it("includes a row scoring exactly 0.45, so the comparison is >=", () => {
      const row = makeRow({ text: words(23) });
      computeDerived([row], vaultLines([makeNote({ id: "edge", sections: { s: section(words(12)) } })]));
      expect(row.restates).toEqual({ score: 0.45, line: words(12), noteId: "edge" });
    });

    it("excludes a row scoring just under", () => {
      // words(11) has 8 shingles: 8 / (20 + 8 - 8) = 8/20 = 0.4.
      const row = makeRow({ text: words(23) });
      const lines = vaultLines([makeNote({ id: "edge", sections: { s: section(words(11)) } })]);
      expect(jaccard(shingles(words(23)), lines[0].sh)).toBe(0.4);
      computeDerived([row], lines);
      expect(row.restates).toBeNull();
    });
  });

  describe("the duplicate threshold of 0.7", () => {
    it("is the exported DUPLICATE_THRESHOLD", () => {
      expect(DUPLICATE_THRESHOLD).toBe(0.7);
    });

    // words(13) has 10 shingles; words(10) has 7, all a subset.
    // 7 / (10 + 7 - 7) = 7/10 = 0.7, exactly on the line.
    it("pairs two rows scoring exactly 0.7, so the comparison is >=", () => {
      const a = makeRow({ text: words(13) });
      const b = makeRow({ text: words(10) });
      computeDerived([a, b], []);
      expect(a.duplicateOf).toEqual({ key: b.key, score: 0.7 });
      expect(b.duplicateOf).toEqual({ key: a.key, score: 0.7 });
    });

    it("leaves two rows scoring just under unpaired", () => {
      // words(13) vs words(9): 6 / (10 + 6 - 6) = 6/10 = 0.6.
      const a = makeRow({ text: words(13) });
      const b = makeRow({ text: words(9) });
      expect(jaccard(shingles(words(13)), shingles(words(9)))).toBe(0.6);
      computeDerived([a, b], []);
      expect(a.duplicateOf).toBeNull();
      expect(b.duplicateOf).toBeNull();
    });
  });

  it("points each of three equally-scoring duplicates at the first partner found", () => {
    const a = makeRow({ text: words(13) });
    const b = makeRow({ text: words(13) });
    const c = makeRow({ text: words(13) });
    computeDerived([a, b, c], []);
    expect(a.duplicateOf).toEqual({ key: b.key, score: 1 });
    expect(b.duplicateOf).toEqual({ key: a.key, score: 1 });
    // All three pairs score 1, and the replacement test is a strict `>`, so
    // every row keeps the earliest partner it was compared against.
    expect(c.duplicateOf).toEqual({ key: a.key, score: 1 });
  });

  it("replaces an earlier weaker duplicate partner with a later stronger one", () => {
    // duplicateOf scans for the best score, the way restates does. Row a meets
    // b first at 0.7 but is a verbatim copy of c, so it must report c at 1.0 —
    // the flag chip and the detail card both quote this pair, and naming the
    // weaker partner shows the reviewer the wrong claim's text beside a score
    // that understates the overlap.
    const a = makeRow({ text: words(13) });
    const b = makeRow({ text: words(10) });
    const c = makeRow({ text: words(13) });
    computeDerived([a, b, c], []);
    expect(a.duplicateOf).toEqual({ key: c.key, score: 1 });
    expect(c.duplicateOf).toEqual({ key: a.key, score: 1 });
    // b's only partner above the threshold is a, at 0.7 either way round.
    expect(b.duplicateOf).toEqual({ key: a.key, score: 0.7 });
  });

  it("replaces a weaker partner on the later row of the pair too", () => {
    // The scan is triangular, so a row can be reached as rows[j]. Here c is
    // paired with b at 0.7 on i=0/j=2 before the exact match with a lands on
    // i=1/j=2, and that hit has to displace the stored 0.7.
    const b = makeRow({ text: words(10) });
    const a = makeRow({ text: words(13) });
    const c = makeRow({ text: words(13) });
    computeDerived([b, a, c], []);
    expect(c.duplicateOf).toEqual({ key: a.key, score: 1 });
    expect(a.duplicateOf).toEqual({ key: c.key, score: 1 });
  });

  it("touches only sh, restates and duplicateOf", () => {
    const row = makeRow({
      text: "the harbor bell is wound every morning without fail",
      disposition: "merge",
      targetTitle: "Harbor",
      conflicts: [{ field: "habits" }],
    });
    const before = { ...row };
    computeDerived([row], []);
    for (const key of Object.keys(before) as Array<keyof Row>) {
      if (key === "sh" || key === "restates" || key === "duplicateOf") continue;
      expect(row[key]).toBe(before[key]);
    }
    expect(row.text).toBe("the harbor bell is wound every morning without fail");
    expect(row.disposition).toBe("merge");
  });

  it("clears a stale duplicateOf from a previous pass", () => {
    const row = makeRow({ text: "a claim with no partner in this batch", duplicateOf: { key: "gone", score: 0.9 } });
    computeDerived([row], []);
    expect(row.duplicateOf).toBeNull();
  });

  it("does nothing observable on an empty batch", () => {
    const rows: Row[] = [];
    expect(computeDerived(rows, [])).toBeUndefined();
    expect(rows).toEqual([]);
  });
});

describe("dedupeLines", () => {
  it("returns null — not an empty result — when nothing was dropped", () => {
    const out = dedupeLines(
      ["the first distinct line of this section here", "an entirely different second line of text"].join("\n"),
    );
    expect(out).toBeNull();
  });

  it("returns null for empty and whitespace-only input", () => {
    expect(dedupeLines("")).toBeNull();
    expect(dedupeLines("   ")).toBeNull();
    expect(dedupeLines("\n\n\n")).toBeNull();
  });

  it("drops a near-identical line and reports how many went", () => {
    // words(10) ⊂ words(13) at exactly DUPLICATE_THRESHOLD; both bodies clear
    // the 25-character floor.
    const out = dedupeLines([words(13), words(10)].join("\n"));
    expect(out).toEqual({ text: words(13), dropped: 1 });
  });

  it("counts each dropped line", () => {
    const out = dedupeLines([words(13), words(10), words(11)].join("\n"));
    expect(out?.dropped).toBe(2);
    expect(out?.text).toBe(words(13));
  });

  it("keeps the position of the first occurrence but the text of the longest", () => {
    const other = "an unrelated sentence that stands alone entirely";
    const out = dedupeLines([words(10), other, words(13)].join("\n"));
    // The survivor sits where words(10) was, ahead of `other`, but carries
    // words(13)'s text.
    expect(out).toEqual({ text: [words(13), other].join("\n"), dropped: 1 });
  });

  it("keeps the earlier line when it is already the longer one", () => {
    const other = "an unrelated sentence that stands alone entirely";
    const out = dedupeLines([words(13), other, words(10)].join("\n"));
    expect(out).toEqual({ text: [words(13), other].join("\n"), dropped: 1 });
  });

  it("never dedupes lines whose body is under 25 characters", () => {
    // Two byte-identical lines, 24 characters each, both survive — this
    // function collapses near-identical prose, and the vault's own exact-match
    // dedup is what handles the short repeats.
    const short = "aaaa bbbb cccc dddd eeee";
    expect(short.length).toBe(24);
    expect(dedupeLines([short, short].join("\n"))).toBeNull();
  });

  it("measures the 25-character floor after stripping the bullet and whitespace", () => {
    const body = "aaaa bbbb cccc dddd eeeee";
    expect(body.length).toBe(25);
    const out = dedupeLines([`- ${body}`, `  * ${body}`].join("\n"));
    expect(out?.dropped).toBe(1);
    // The kept line keeps its raw form, bullet and all: only the comparison
    // strips markers.
    expect(out?.text).toBe(`- ${body}`);
  });

  it("collapses runs of three or more newlines and trims the result", () => {
    const out = dedupeLines(["", words(13), "", "", "", words(10), ""].join("\n"));
    expect(out?.dropped).toBe(1);
    expect(out?.text).toBe(words(13));
  });

  it("preserves the order of lines it keeps", () => {
    const a = "the harbor bell is wound every single morning";
    const b = "the lighthouse keeper writes down the tide each evening";
    const out = dedupeLines([a, b, a].join("\n"));
    expect(out).toEqual({ text: [a, b].join("\n"), dropped: 1 });
  });

  it("collapses a cluster whose members all match the first line kept", () => {
    // A single pass suffices here: words(10) is shorter than words(13), so it
    // never replaces the survivor and no comparison is invalidated.
    const out = dedupeLines([words(13), words(10), words(13)].join("\n"));
    expect(out).toEqual({ text: words(13), dropped: 2 });
  });

  describe("re-runs the pass until it drops nothing", () => {
    // A pass breaks at the first cluster hit, and when a longer line replaces
    // the survivor the comparisons already made against the old survivor are
    // not redone — so one pass leaves behind a line that matched the replaced
    // survivor but not its replacement. These three are that shape: b and c are
    // each a plus a tail, and only a~c falls under the threshold.
    const a = words(12); // 9 shingles
    const b = words(14); // 11 shingles
    const c = words(17); // 14 shingles

    it("has the similarities the escape depends on", () => {
      expect(jaccard(shingles(a), shingles(b))).toBeCloseTo(9 / 11); // 0.82
      expect(jaccard(shingles(b), shingles(c))).toBeCloseTo(11 / 14); // 0.79
      expect(jaccard(shingles(a), shingles(c))).toBeCloseTo(9 / 14); // 0.64
      expect(9 / 14).toBeLessThan(DUPLICATE_THRESHOLD);
      expect(11 / 14).toBeGreaterThan(DUPLICATE_THRESHOLD);
    });

    it("collapses a cluster the first pass would leave two lines of", () => {
      // One pass keeps a, then replaces it with b (0.82), then keeps c because
      // c~b was never scored — leaving two survivors 0.79 apart, which the same
      // function calls a duplicate. The second pass takes c.
      expect(dedupeLines([a, c, b].join("\n"))).toEqual({ text: c, dropped: 2 });
    });

    it("reaches the same result when the cluster arrives in ascending order", () => {
      expect(dedupeLines([a, b, c].join("\n"))).toEqual({ text: c, dropped: 2 });
    });

    it("reports the total dropped across every pass, not the last pass's count", () => {
      // Pass one drops b, pass two drops c: a single-pass count would say 1.
      expect(dedupeLines([a, c, b].join("\n"))?.dropped).toBe(2);
    });

    it("still returns null when the first pass drops nothing", () => {
      expect(dedupeLines([a, "an unrelated sentence that stands alone entirely"].join("\n"))).toBeNull();
    });
  });
});
