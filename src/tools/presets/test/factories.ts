// Decoded rows, which is what a model function sees once the wire is parsed.
import type { PresetFull, PromptGroup, PromptPreset, PromptSection } from "../api/schema";

export const preset = (over: Partial<PromptPreset> = {}): PromptPreset => ({
  id: "preset_example",
  name: "Example",
  description: "",
  conversationPrompt: "",
  gamePrompt: "",
  sectionOrder: [],
  wrapFormat: "xml",
  isDefault: false,
  author: "",
  systemKey: null,
  defaultChoices: {},
  parameters: {},
  updatedAt: "2026-08-21T20:53:08.720Z",
  ...over,
});

export const section = (over: Partial<PromptSection> = {}): PromptSection => ({
  id: "section_example",
  presetId: "preset_example",
  identifier: "section_1",
  name: "Role",
  content: "",
  role: "system",
  enabled: true,
  isMarker: false,
  markerConfig: null,
  groupId: null,
  injectionPosition: "ordered",
  injectionDepth: 0,
  injectionOrder: 100,
  forbidOverrides: false,
  ...over,
});

export const group = (over: Partial<PromptGroup> = {}): PromptGroup => ({
  id: "group_example",
  name: "Lore",
  enabled: true,
  ...over,
});

export const full = (over: Partial<PresetFull> = {}): PresetFull => ({
  preset: preset(),
  sections: [],
  groups: [],
  choiceBlocks: [],
  ...over,
});
