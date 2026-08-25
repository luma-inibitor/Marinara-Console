// Fixtures are real dev-engine responses with the contents replaced. The
// string booleans and JSON strings are verbatim: that is what a TEXT column gives back.

import { describe, expect, it } from "vitest";
import * as v from "valibot";
import { PresetFullSchema, PresetSchema, SectionSchema } from "./schema";

const ok = (schema: Parameters<typeof v.safeParse>[0], value: unknown) => v.safeParse(schema, value).success;

const preset = () => ({
  id: "preset_example",
  name: "Example",
  description: "A preset.",
  imagePath: null,
  conversationPrompt: "You are {{role}}.",
  gamePrompt: "Follow the rules.",
  sectionOrder: "[\"section_example\"]",
  groupOrder: "[\"group_example\"]",
  variableGroups: "[]",
  variableValues: "{}",
  parameters: "{}",
  wrapFormat: "xml",
  defaultChoices: "{\"role\":\"a narrator\"}",
  isDefault: "false",
  author: "Example",
  systemKey: "example-preset",
  embedding: null,
  createdAt: "2026-03-04T14:46:18.499Z",
  updatedAt: "2026-08-21T20:53:08.720Z",
});

const section = () => ({
  id: "section_example",
  presetId: "preset_example",
  identifier: "section_1772663501549",
  name: "Role",
  content: "You are {{role}}!",
  role: "system",
  enabled: "true",
  isMarker: "false",
  groupId: null,
  markerConfig: null,
  injectionPosition: "ordered",
  injectionDepth: 0,
  injectionOrder: 100,
  wrapInXml: "false",
  xmlTagName: "",
  forbidOverrides: "false",
});

const group = () => ({ id: "group_example", presetId: "preset_example", name: "Lore", parentGroupId: null, order: 100, enabled: "true", createdAt: "2026-08-21T04:48:04.829Z" });
const choiceBlock = () => ({ id: "choice_example", presetId: "preset_example", variableName: "role", question: "Pick one.", options: "[{\"id\":\"opt_a\",\"label\":\"Narrator\",\"value\":\"a narrator\"}]", multiSelect: "false", sortOrder: 100 });
const full = () => ({ preset: preset(), sections: [section()], groups: [group()], choiceBlocks: [choiceBlock()] });

describe("PresetSchema", () => {
  it("accepts a preset in the shape the live engine sends", () => {
    expect(ok(PresetSchema, preset())).toBe(true);
  });

  it("decodes the TEXT columns the tool reads", () => {
    const parsed = v.parse(PresetSchema, preset());
    expect(parsed.isDefault).toBe(false);
    expect(parsed.sectionOrder).toEqual(["section_example"]);
    expect(parsed.defaultChoices).toEqual({ role: "a narrator" });
  });

  it("accepts the same fields already decoded, which is what a JSON column would give", () => {
    const parsed = v.parse(PresetSchema, { ...preset(), isDefault: true, sectionOrder: ["section_example"] });
    expect(parsed.isDefault).toBe(true);
    expect(parsed.sectionOrder).toEqual(["section_example"]);
  });

  it("keeps the fields it does not name, rather than stripping them", () => {
    expect(v.parse(PresetSchema, preset()).variableValues).toBe("{}");
  });

  it("accepts a preset with no system key, which is every one a person made", () => {
    expect(ok(PresetSchema, { ...preset(), systemKey: null })).toBe(true);
  });

  it("rejects a flag that is neither of the two strings nor a boolean", () => {
    for (const bad of ["yes", "", "0", 1, null]) {
      expect(ok(PresetSchema, { ...preset(), isDefault: bad })).toBe(false);
    }
  });

  it("rejects a section order that decodes to something other than a list", () => {
    expect(ok(PresetSchema, { ...preset(), sectionOrder: "{}" })).toBe(false);
  });

  it("rejects a column whose text is not JSON at all", () => {
    expect(ok(PresetSchema, { ...preset(), parameters: "not json" })).toBe(false);
  });

  it("rejects a context window sent as a string", () => {
    expect(ok(PresetSchema, { ...preset(), parameters: "{\"maxContext\":\"8192\"}" })).toBe(false);
  });

  it("rejects a preset whose id is empty", () => {
    expect(ok(PresetSchema, { ...preset(), id: "" })).toBe(false);
  });
});

describe("SectionSchema", () => {
  it("accepts a section in the shape the live engine sends", () => {
    expect(ok(SectionSchema, section())).toBe(true);
  });

  it("decodes the three flags the assembler reads", () => {
    const parsed = v.parse(SectionSchema, section());
    expect(parsed.enabled).toBe(true);
    expect(parsed.isMarker).toBe(false);
    expect(parsed.forbidOverrides).toBe(false);
  });

  it("decodes a marker config, which is what tells a marker from a section", () => {
    const parsed = v.parse(SectionSchema, { ...section(), isMarker: "true", markerConfig: "{\"type\":\"lorebook\"}" });
    expect(parsed.markerConfig).toEqual({ type: "lorebook" });
  });

  it("rejects a marker config that decodes without a type", () => {
    expect(ok(SectionSchema, { ...section(), markerConfig: "{}" })).toBe(false);
  });

  it("rejects an injection number sent as a string", () => {
    for (const field of ["injectionDepth", "injectionOrder"]) {
      expect(ok(SectionSchema, { ...section(), [field]: "0" })).toBe(false);
    }
  });

  it("rejects a flag that is neither of the two strings nor a boolean", () => {
    expect(ok(SectionSchema, { ...section(), enabled: 1 })).toBe(false);
  });
});

describe("PresetFullSchema", () => {
  it("accepts the editor payload in the shape the live engine sends", () => {
    expect(ok(PresetFullSchema, full())).toBe(true);
  });

  it("decodes the group flag the assembler drops a whole run on", () => {
    expect(v.parse(PresetFullSchema, full()).groups[0].enabled).toBe(true);
  });

  it("decodes the options of a choice block", () => {
    expect(v.parse(PresetFullSchema, full()).choiceBlocks[0].options[0].label).toBe("Narrator");
  });

  it("accepts a preset with no groups and no choice blocks", () => {
    expect(ok(PresetFullSchema, { ...full(), groups: [], choiceBlocks: [] })).toBe(true);
  });

  it("rejects the whole payload when one section does not parse", () => {
    expect(ok(PresetFullSchema, { ...full(), sections: [section(), { ...section(), id: "second", enabled: "yes" }] })).toBe(false);
  });

  it("rejects an envelope missing the sections it is fetched for", () => {
    const { sections, ...rest } = full();
    void sections;
    expect(ok(PresetFullSchema, rest)).toBe(false);
  });
});
