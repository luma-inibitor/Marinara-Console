import { describe, expect, it } from "vitest";
import { splitTitle } from "./MiddleTruncate";

const BOOK = "Lorebook - Ashgate — Harbour Canon: ";

describe("splitTitle", () => {
  it("keeps a title shorter than the tail whole", () => {
    expect(splitTitle("Harbourmaster Vell")).toEqual(["Harbourmaster Vell", ""]);
  });

  it("leaves the part that distinguishes a shared prefix in the tail", () => {
    for (const entry of ["Ashgate — The City", "The Tidewatch Compact", "Marrow Lane", "The Guild of Cinders"]) {
      const [head, tail] = splitTitle(BOOK + entry);
      expect(head).toContain("Lorebook");
      expect(tail).toContain(entry);
    }
  });

  it("starts the tail on a word when one is within reach", () => {
    expect(splitTitle(BOOK + "Marrow Lane")[1]).toBe("Harbour Canon: Marrow Lane");
  });

  it("splits where the count says when no word boundary is in reach", () => {
    const [head, tail] = splitTitle(`x${"y".repeat(40)}`, 10);
    expect(head).toBe("xyyyyyyyyyyyyyyyyyyyyyyyyyyyyyy");
    expect(tail).toBe("yyyyyyyyyy");
  });

  it("counts graphemes, so a split never lands inside one", () => {
    const [head, tail] = splitTitle(`${"a".repeat(30)}👩‍👧‍👦é`, 2);
    expect(head).toBe("a".repeat(30));
    expect(tail).toBe("👩‍👧‍👦é");
  });

  it("rejoins to the original", () => {
    const text = `${BOOK}The Tidewatch Compact`;
    expect(splitTitle(text).join("")).toBe(text);
  });
});
