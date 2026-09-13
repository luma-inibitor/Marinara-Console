import { describe, expect, it, vi } from "vitest";

vi.mock("../../../copy", () => ({
  t: (key: string, params?: Record<string, unknown>) =>
    params && Object.keys(params).length
      ? `${key}|${Object.entries(params)
          .map(([k, v]) => `${k}=${v}`)
          .join(",")}`
      : key,
}));

import { SECTION_CAP } from "../model/caps";
import { chars, makeNote, section } from "../test/factories";
import {
  dimensionRows,
  editStamp,
  evidenceRef,
  percentOf,
  scopeEntries,
  sectionLines,
  sectionMeta,
  sectionViews,
  signed,
  startsCollapsed,
} from "./model";

describe("sectionLines", () => {
  it("splits on blank lines and strips a leading bullet", () => {
    expect(sectionLines("- one\n\n  * two\nthree")).toEqual(["one", "two", "three"]);
  });

  it("is empty for empty text", () => {
    expect(sectionLines("")).toEqual([]);
  });
});

describe("sectionViews", () => {
  it("keeps payload order and carries the section itself", () => {
    const voice = section("b", { confidence: 0.5 });
    const note = makeNote({ sections: { voice, core: section("a") } });
    const views = sectionViews(note);
    expect(views.map((v) => v.key)).toEqual(["voice", "core"]);
    expect(views[0].section).toBe(voice);
    expect(views[0].chars).toBe(1);
  });

  it("flags a section from 80% of the cap, and names the far side past it", () => {
    const note = makeNote({
      sections: {
        under: section(chars(SECTION_CAP * 0.8 - 1)),
        near: section(chars(SECTION_CAP * 0.8)),
        full: section(chars(SECTION_CAP)),
        over: section(chars(SECTION_CAP + 1)),
      },
    });
    const [under, near, full, over] = sectionViews(note);
    expect(under.flag).toBeNull();
    expect(near.flag?.sentence).toMatch(/^memory\.detail\.sectionNearCap\|key=near,pct=80,/);
    expect(full.flag?.sentence).toMatch(/^memory\.detail\.sectionNearCap\|key=full,pct=100,/);
    expect(over.flag?.sentence).toMatch(/^memory\.detail\.sectionOverCap\|key=over,pct=100,/);
    expect(over.flag?.ratio).toBeGreaterThan(1);
  });
});

describe("sectionMeta", () => {
  it("reports lines and a formatted character count", () => {
    const [view] = sectionViews(makeNote({ sections: { core: section(`${chars(600)}\n${chars(600)}`) } }));
    expect(sectionMeta(view)).toBe("memory.detail.sectionMeta|count=2,chars=1,201");
  });
});

describe("startsCollapsed", () => {
  it("folds every source, whatever its section count", () => {
    expect(startsCollapsed({ type: "source" }, 1)).toBe(true);
  });

  it("folds any other type only past six sections", () => {
    expect(startsCollapsed({ type: "character" }, 6)).toBe(false);
    expect(startsCollapsed({ type: "character" }, 7)).toBe(true);
  });
});

describe("editStamp", () => {
  it("renders a local date and time without seconds", () => {
    const d = new Date(2026, 7, 23, 14, 40, 9);
    expect(editStamp(d.toISOString())).toBe("2026-08-23 14:40");
  });

  it("is null for nothing or for an unparseable value", () => {
    expect(editStamp(undefined)).toBeNull();
    expect(editStamp("last tuesday")).toBeNull();
  });
});

describe("percentOf", () => {
  it("rounds a 0–1 score to a whole percentage", () => {
    expect(percentOf(0.925)).toBe(93);
    expect(percentOf(0)).toBe(0);
    expect(percentOf(1)).toBe(100);
  });

  it("clamps a score outside the range", () => {
    expect(percentOf(1.5)).toBe(100);
    expect(percentOf(-0.2)).toBe(0);
  });
});

describe("signed", () => {
  it("prefixes a sign except on zero", () => {
    expect(signed(12)).toBe("+12");
    expect(signed(-3)).toBe("-3");
    expect(signed(0)).toBe("0");
  });
});

describe("evidenceRef", () => {
  it("splits a snake_case kind from its id at the first colon", () => {
    expect(evidenceRef("source_note:source_lorebook_7a82")).toEqual({
      kind: "source_note",
      id: "source_lorebook_7a82",
    });
    expect(evidenceRef("lorebook_entry:72cg7ex-9KOe3cWzTqdEV")).toEqual({
      kind: "lorebook_entry",
      id: "72cg7ex-9KOe3cWzTqdEV",
    });
    expect(evidenceRef("chat:a:b")).toEqual({ kind: "chat", id: "a:b" });
  });

  it("is null for a quote", () => {
    expect(evidenceRef("Mira: Hold the line there.")).toBeNull();
    expect(evidenceRef("note: the boards were wrong")).toBeNull();
    expect(evidenceRef("No colon at all")).toBeNull();
  });
});

describe("scopeEntries", () => {
  it("is empty for a global scope", () => {
    expect(scopeEntries(undefined)).toEqual([]);
    expect(scopeEntries({})).toEqual([]);
  });

  it("unions each scalar with its array, deduplicated, in family order", () => {
    expect(
      scopeEntries({
        personaId: "p1",
        chatIds: ["c2"],
        chatId: "c1",
        characterIds: ["k1", "k1"],
        personaIds: ["p1", "p2"],
      }),
    ).toEqual([
      { field: "chatIds", ids: ["c1", "c2"] },
      { field: "characterIds", ids: ["k1"] },
      { field: "personaIds", ids: ["p1", "p2"] },
    ]);
  });
});

describe("dimensionRows", () => {
  it("is empty when neither record is present", () => {
    expect(dimensionRows(undefined, undefined)).toEqual([]);
  });

  it("keeps only named axes, in schema order, with whichever figures exist", () => {
    expect(dimensionRows({ tension: 70, trust: 40 }, { tension: -5, lust: 10 })).toEqual([
      { axis: "trust", value: 40 },
      { axis: "tension", value: 70, delta: -5 },
      { axis: "lust", delta: 10 },
    ]);
  });

  it("keeps a zero, which is a figure, and drops an unknown key", () => {
    expect(dimensionRows({ trust: 0, warmth: 50 }, undefined)).toEqual([{ axis: "trust", value: 0 }]);
  });
});
