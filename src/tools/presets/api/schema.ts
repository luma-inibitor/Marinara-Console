// The prompt-preset wire, and the schemas that decode it.
//
// WIRE FORMAT WARNING — the engine stores booleans and nested objects as TEXT
// columns (packages/server/src/db/schema/prompts.ts), so `isDefault`,
// `enabled`, `isMarker`, `forbidOverrides` arrive as the strings "true"/"false"
// and `markerConfig`/`defaultChoices`/`parameters` arrive as JSON strings.
// `"false"` is truthy, so every raw truthiness test silently passes. The
// engine's own client normalizes the same way (PresetEditor.tsx: `enabled ===
// "true" || enabled === true`). Everything here is decoded at the wire
// boundary; the model and the screens only ever see real booleans and parsed
// objects.
import * as v from "valibot";

/** A plain `v.boolean()` rejects every live preset: the TEXT columns send
 *  `"true"` and `"false"`. This takes those two strings and the two booleans a
 *  JSON column would have given, and nothing else. */
const wireBool = v.pipe(
  v.union([v.boolean(), v.picklist(["true", "false"])]),
  v.transform((raw) => raw === true || raw === "true"),
);

/** A JSON string, or the value already decoded, checked against `inner` either
 *  way. The tool maps over `sectionOrder` and divides by
 *  `parameters.maxContext`, so a decode is not enough on its own. */
const jsonText = <S extends v.BaseSchema<unknown, unknown, v.BaseIssue<unknown>>>(inner: S) =>
  v.pipe(v.unknown(), v.rawTransform<unknown, v.InferOutput<S>>(({ dataset, addIssue, NEVER }) => {
    let decoded = dataset.value;
    if (typeof decoded === "string") {
      try { decoded = JSON.parse(decoded); } catch { addIssue({ expected: "json" }); return NEVER; }
    }
    const result = v.safeParse(inner, decoded);
    if (!result.success) { addIssue({ expected: "json", received: result.issues[0].message }); return NEVER; }
    return result.output;
  }));

const id = v.pipe(v.string(), v.minLength(1));

/** `wrapFormat` and `role` render as themselves, not through the catalog. */
export const PresetSchema = v.looseObject({
  id,
  name: v.string(),
  description: v.string(),
  conversationPrompt: v.string(),
  gamePrompt: v.string(),
  sectionOrder: jsonText(v.array(v.string())),
  wrapFormat: v.string(),
  isDefault: wireBool,
  author: v.string(),
  systemKey: v.nullable(v.string()),
  defaultChoices: jsonText(v.record(v.string(), v.union([v.string(), v.array(v.string())]))),
  parameters: jsonText(v.looseObject({ maxContext: v.optional(v.number()) })),
  updatedAt: v.string(),
});

export const SectionSchema = v.looseObject({
  id,
  presetId: v.string(),
  identifier: v.string(),
  name: v.string(),
  content: v.string(),
  role: v.string(),
  enabled: wireBool,
  isMarker: wireBool,
  markerConfig: v.nullable(jsonText(v.looseObject({ type: v.string() }))),
  groupId: v.nullable(v.string()),
  injectionPosition: v.string(),
  injectionDepth: v.number(),
  injectionOrder: v.number(),
  forbidOverrides: wireBool,
});

const GroupSchema = v.looseObject({ id, name: v.string(), enabled: wireBool });

const ChoiceBlockSchema = v.looseObject({
  id,
  variableName: v.string(),
  question: v.string(),
  options: jsonText(v.array(v.looseObject({ id: v.string(), label: v.string(), value: v.string() }))),
});

export const PresetFullSchema = v.looseObject({
  preset: PresetSchema,
  sections: v.array(SectionSchema),
  groups: v.array(GroupSchema),
  choiceBlocks: v.array(ChoiceBlockSchema),
});

export type PromptPreset = v.InferOutput<typeof PresetSchema>;
export type PromptSection = v.InferOutput<typeof SectionSchema>;
export type PromptGroup = v.InferOutput<typeof GroupSchema>;
export type PresetFull = v.InferOutput<typeof PresetFullSchema>;
