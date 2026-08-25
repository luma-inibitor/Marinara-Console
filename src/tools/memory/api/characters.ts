// The host's characters. Like /chats, not a long-term-memory route: scope
// names a character the engine already knows about.

import * as v from "valibot";
import { api } from "../../../shell/api";
import { parseItems } from "../../../shell/wire";

/** As the endpoint answers: the card's own JSON arrives as a string field, and
 *  `name` is only sometimes hoisted out of it — the live host never does, so
 *  every row goes through `model/character.ts` to get one. */
export const CharacterRowSchema = v.looseObject({
  id: v.pipe(v.string(), v.minLength(1)),
  data: v.optional(v.string()),
  name: v.optional(v.string()),
});

export type CharacterRow = v.InferOutput<typeof CharacterRowSchema>;

/** An empty list rather than a shape nobody can use, for the same reason
 *  `fetchChats` normalises its two: the caller should not have to know. */
export const fetchCharacters = async (): Promise<CharacterRow[]> => {
  const r = await api<unknown>("/characters");
  return parseItems(CharacterRowSchema, Array.isArray(r) ? r : [], "GET /characters");
};
