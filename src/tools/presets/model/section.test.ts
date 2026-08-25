import { describe, expect, it } from "vitest";
import { full, group, preset, section } from "../test/factories";
import { effectivelyEnabled, groupRunBoundaries, orderedSections, sectionTokens } from "./section";

describe("effectivelyEnabled", () => {
  it("drops a section whose own flag is off", () => {
    expect(effectivelyEnabled(section({ enabled: false }), [])).toBe(false);
  });

  it("keeps a section in no group", () => {
    expect(effectivelyEnabled(section(), [group({ enabled: false })])).toBe(true);
  });

  it("drops a section whose group is disabled, whatever its own flag says", () => {
    const s = section({ groupId: "group_example" });
    expect(effectivelyEnabled(s, [group({ enabled: false })])).toBe(false);
    expect(effectivelyEnabled(s, [group({ enabled: true })])).toBe(true);
  });

  it("keeps a section whose group is not in the payload", () => {
    expect(effectivelyEnabled(section({ groupId: "missing" }), [group()])).toBe(true);
  });
});

describe("sectionTokens", () => {
  it("counts the content with its macros expanded", () => {
    const p = preset({ defaultChoices: { role: "a narrator" } });
    expect(sectionTokens(section({ content: "{{role}}" }), p)).toBe(3);
  });

  it("counts a marker as nothing, because it fills in at runtime", () => {
    const marker = section({ content: "ignored", isMarker: true, markerConfig: { type: "lorebook" } });
    expect(sectionTokens(marker, preset())).toBe(0);
  });
});

describe("orderedSections", () => {
  it("follows the preset's order", () => {
    const f = full({
      preset: preset({ sectionOrder: ["b", "a"] }),
      sections: [section({ id: "a" }), section({ id: "b" })],
    });
    expect(orderedSections(f).map((s) => s.id)).toEqual(["b", "a"]);
  });

  it("keeps a section the order does not mention, after the ones it does", () => {
    const f = full({
      preset: preset({ sectionOrder: ["b"] }),
      sections: [section({ id: "a" }), section({ id: "b" })],
    });
    expect(orderedSections(f).map((s) => s.id)).toEqual(["b", "a"]);
  });

  it("ignores an id in the order with no section behind it", () => {
    const f = full({ preset: preset({ sectionOrder: ["gone", "a"] }), sections: [section({ id: "a" })] });
    expect(orderedSections(f).map((s) => s.id)).toEqual(["a"]);
  });
});

describe("groupRunBoundaries", () => {
  it("marks only consecutive members as one run", () => {
    const runs = groupRunBoundaries([
      section({ id: "a", groupId: "g" }),
      section({ id: "b", groupId: "g" }),
      section({ id: "c", groupId: "g" }),
      section({ id: "d" }),
      section({ id: "e", groupId: "g" }),
    ]);
    expect([...runs]).toEqual([["a", "start"], ["b", "mid"], ["c", "end"], ["e", "solo"]]);
  });

  it("says nothing about a section in no group", () => {
    expect(groupRunBoundaries([section({ id: "a" })]).size).toBe(0);
  });
});
