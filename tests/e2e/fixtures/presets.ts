// The prompt-preset corpus: what GET /prompts and GET /prompts/:id/full answer.
//
// This is the heaviest fixture, and the only one written in the engine's raw
// wire form rather than the console's. The engine stores booleans and nested
// objects as TEXT columns, so `isDefault`, `enabled`, `isMarker` and
// `forbidOverrides` arrive as the strings "true"/"false" and `sectionOrder`,
// `parameters`, `markerConfig`, `defaultChoices` and `options` arrive as JSON
// strings — see the WIRE FORMAT WARNING in src/tools/presets/data.ts. A fixture
// written in the normalised shape would pass every screen and prove nothing,
// because the whole point of `norm*` is that "false" is truthy.
//
// UNGUARDED. There is no valibot schema for a preset or a section, and the
// wire shape is `Record<string, unknown>` on both sides of `fetchFull`, so
// neither `tsc` nor tests/e2e/corpus.spec.ts can tell you when this drifts
// from what the engine sends. Only the smoke test's row counts will, and only
// when a field the screen actually renders goes missing. Do not read the row
// counts as schema coverage.

/** One row as the engine sends it: `fetchFull`'s own declared parameter type. */
type Wire = Record<string, unknown>;

export interface PresetFullWire {
  preset: Wire;
  sections: Wire[];
  groups: Wire[];
  choiceBlocks: Wire[];
}

export const PRESET_ID = "preset-house";

/** Fields every preset row carries, at an inert value. */
const preset = (over: Wire): Wire => ({
  description: "",
  conversationPrompt: "",
  gamePrompt: "",
  sectionOrder: "[]",
  wrapFormat: "xml",
  isDefault: "false",
  author: "luma",
  systemKey: null,
  defaultChoices: "{}",
  parameters: JSON.stringify({ maxContext: 32000 }),
  updatedAt: "2026-02-14T18:40:00.000Z",
  ...over,
});

/** Fields every section row carries, at an inert value. `enabled` is the
 *  string "true" for the same reason the whole file is in wire form. */
const section = (presetId: string, over: Wire): Wire => ({
  presetId,
  content: "",
  role: "system",
  enabled: "true",
  isMarker: "false",
  markerConfig: null,
  groupId: null,
  injectionPosition: "ordered",
  injectionDepth: 0,
  injectionOrder: 0,
  forbidOverrides: "false",
  ...over,
});

const marker = (presetId: string, over: Wire & { markerConfig: string }): Wire =>
  section(presetId, { isMarker: "true", ...over });

const HOUSE_SECTIONS: Wire[] = [
  section(PRESET_ID, {
    id: "s-voice", identifier: "voice", name: "House voice",
    content: "Write plainly. Do not explain the harbour to people who live in it. Two to four paragraphs, ending on something actionable.",
  }),
  section(PRESET_ID, {
    id: "s-safety", identifier: "safety", name: "Lines and veils", forbidOverrides: "true",
    content: "Never harm the ferry children. Weather is never a punishment for a choice the player made.",
  }),
  marker(PRESET_ID, { id: "s-char", identifier: "character", name: "Character card", markerConfig: JSON.stringify({ type: "character" }) }),
  marker(PRESET_ID, { id: "s-persona", identifier: "persona", name: "Persona", markerConfig: JSON.stringify({ type: "persona" }) }),
  marker(PRESET_ID, { id: "s-lore", identifier: "lorebook", name: "Lorebook", markerConfig: JSON.stringify({ type: "lorebook" }) }),
  section(PRESET_ID, {
    id: "s-style", identifier: "style", name: "Style guardrails", groupId: "g-craft",
    content: "No lyric weather. No summarising the scene back to the player. Names come off the tide boards: Ashe, Vance, Tolley, Merrow.",
  }),
  section(PRESET_ID, {
    id: "s-pacing", identifier: "pacing", name: "Pacing", groupId: "g-craft",
    content: "One beat per reply. If the player asked a question, answer it before moving.",
  }),
  section(PRESET_ID, {
    id: "s-dialogue", identifier: "dialogue", name: "Dialogue", groupId: "g-craft", enabled: "false",
    content: "Held back while the voice section is being rewritten.",
  }),
  marker(PRESET_ID, { id: "s-history", identifier: "history", name: "Chat history", markerConfig: JSON.stringify({ type: "chat_history" }) }),
  section(PRESET_ID, {
    id: "s-recall", identifier: "recall", name: "Recall discipline", groupId: "g-memory",
    content: "Prefer what the memory says over what the last reply implied. If the two disagree, the memory is right and the scene moves on.",
  }),
  section(PRESET_ID, {
    id: "s-close", identifier: "closing", name: "Closing instruction", injectionPosition: "depth", injectionDepth: 2,
    content: "End the reply on an image or an offer, never on a summary. {{tone}}",
  }),
];

const LEAN_SECTIONS: Wire[] = [
  section("preset-lean", { id: "l-voice", identifier: "voice", name: "Voice", content: "Short, cold, specific." }),
  marker("preset-lean", { id: "l-char", identifier: "character", name: "Character card", markerConfig: JSON.stringify({ type: "character" }) }),
  marker("preset-lean", { id: "l-history", identifier: "history", name: "Chat history", markerConfig: JSON.stringify({ type: "chat_history" }) }),
  section("preset-lean", { id: "l-close", identifier: "closing", name: "Closing", content: "Stop when the beat is done." }),
];

const GAME_SECTIONS: Wire[] = [
  section("preset-game", { id: "g-rules", identifier: "rules", name: "Table rules", content: "Never roll for weather. The weather is written." }),
  section("preset-game", { id: "g-state", identifier: "state", name: "State block", content: "Report tide, light and bell at the top of every reply." }),
  marker("preset-game", { id: "g-agent", identifier: "agent", name: "Agent data", markerConfig: JSON.stringify({ type: "agent_data" }) }),
  marker("preset-game", { id: "g-summary", identifier: "summary", name: "Chat summary", markerConfig: JSON.stringify({ type: "chat_summary" }) }),
  section("preset-game", { id: "g-close", identifier: "closing", name: "Closing", enabled: "false", content: "Superseded by the state block." }),
];

export const PRESETS: Wire[] = [
  preset({
    id: PRESET_ID, name: "Harbour house style", isDefault: "true",
    description: "The default: house voice, safety lines, and the three cards.",
    conversationPrompt: "You are running a scene in the harbour town. {{tone}}",
    gamePrompt: "You are running the harbour as a game. Track tide, light and bell.",
    sectionOrder: JSON.stringify(HOUSE_SECTIONS.map((s) => s.id)),
    defaultChoices: JSON.stringify({ tone: "cold" }),
    parameters: JSON.stringify({ maxContext: 32000 }),
  }),
  preset({
    id: "preset-lean", name: "Lean", wrapFormat: "markdown",
    description: "Four sections and nothing else. Used when the context is tight.",
    conversationPrompt: "Run the scene. Keep it short.",
    sectionOrder: JSON.stringify(LEAN_SECTIONS.map((s) => s.id)),
    parameters: JSON.stringify({ maxContext: 8000 }),
  }),
  preset({
    id: "preset-game", name: "Harbour game (built-in)", systemKey: "harbour.game", wrapFormat: "none",
    description: "",
    gamePrompt: "Track tide, light and bell. Report them every reply.",
    sectionOrder: JSON.stringify(GAME_SECTIONS.map((s) => s.id)),
    parameters: JSON.stringify({ maxContext: 16000 }),
  }),
];

export const FULL: Record<string, PresetFullWire> = {
  [PRESET_ID]: {
    preset: PRESETS[0],
    sections: HOUSE_SECTIONS,
    // One group disabled, because the assembler drops a section whose GROUP is
    // off regardless of the section's own flag, and a fixture with only enabled
    // groups never exercises that rule.
    groups: [
      { id: "g-craft", name: "Craft", enabled: "true" },
      { id: "g-memory", name: "Memory", enabled: "false" },
    ],
    choiceBlocks: [{
      id: "cb-tone", variableName: "tone", question: "How cold?",
      options: JSON.stringify([
        { id: "o-cold", label: "Cold", value: "Keep the narration cold." },
        { id: "o-warm", label: "Warmer", value: "Allow one warm image per scene." },
      ]),
    }],
  },
  "preset-lean": { preset: PRESETS[1], sections: LEAN_SECTIONS, groups: [], choiceBlocks: [] },
  "preset-game": { preset: PRESETS[2], sections: GAME_SECTIONS, groups: [], choiceBlocks: [] },
};
