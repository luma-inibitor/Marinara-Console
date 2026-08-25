import { describe, expect, it } from "vitest";
import { full, group, preset, section } from "../test/factories";
import { presetLoad } from "./load";

const example = () => full({
  preset: preset({
    sectionOrder: ["a", "b"],
    conversationPrompt: "12345678",
    gamePrompt: "1234",
    defaultChoices: { role: "12345678" },
  }),
  sections: [
    section({ id: "a", content: "12345678" }),
    section({ id: "b", content: "1234", enabled: false }),
    section({ id: "c", content: "ignored", isMarker: true, markerConfig: { type: "lorebook" } }),
    section({ id: "d", content: "1234", groupId: "group_example" }),
  ],
  groups: [group({ enabled: false })],
});

describe("presetLoad", () => {
  it("counts only the sections the assembler would keep", () => {
    const load = presetLoad(example(), "conversation");
    expect(load.totalSections).toBe(4);
    expect(load.enabled).toBe(2);        // b is off, d's group is off
    expect(load.sectionTok).toBe(2);     // a is 8 chars; the marker counts nothing
    expect(load.markers).toBe(1);
  });

  it("reads the prompt of the mode it was asked for", () => {
    expect(presetLoad(example(), "conversation").promptTok).toBe(2);
    expect(presetLoad(example(), "game").promptTok).toBe(1);
  });

  it("totals the sections and the prompt together", () => {
    const load = presetLoad(example(), "conversation");
    expect(load.total).toBe(load.sectionTok + load.promptTok);
  });

  it("expands macros in the prompt before counting it", () => {
    const f = full({ preset: preset({ conversationPrompt: "{{role}}", defaultChoices: { role: "12345678" } }) });
    expect(presetLoad(f, "conversation").promptTok).toBe(2);
  });

  it("reads an empty preset as costing nothing", () => {
    const load = presetLoad(full(), "conversation");
    expect(load).toEqual({ sectionTok: 0, promptTok: 0, total: 0, enabled: 0, totalSections: 0, markers: 0 });
  });
});
