// The book and entry wire, and the schemas that check it.
import * as v from "valibot";

const id = v.pipe(v.string(), v.minLength(1));
const strings = v.array(v.string());

export const LorebookSchema = v.looseObject({
  id,
  name: v.string(),
  tokenBudget: v.number(),
  enabled: v.boolean(),
});

/** `selectiveLogic` is closed because `testSecondaryKeys` answers `true` for a
 *  logic it does not recognise, which would draw the entry as always firing. */
export const EntrySchema = v.looseObject({
  id,
  name: v.string(),
  content: v.string(),
  description: v.string(),
  keys: strings,
  secondaryKeys: strings,
  enabled: v.boolean(),
  constant: v.boolean(),
  selective: v.boolean(),
  selectiveLogic: v.picklist(["and", "and_all", "or", "not", "not_all"]),
  useRegex: v.boolean(),
  matchWholeWords: v.boolean(),
  caseSensitive: v.boolean(),
  position: v.number(),
  outletName: v.string(),
  depth: v.number(),
  order: v.number(),
  tag: v.string(),
  /** Not the engine's: server.mjs swaps the vector out for whether there was one. */
  hasEmbedding: v.optional(v.boolean()),
  updatedAt: v.optional(v.string()),
});

export type Lorebook = v.InferOutput<typeof LorebookSchema>;
export type Entry = v.InferOutput<typeof EntrySchema>;
