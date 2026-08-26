// The host's characters. Like /chats, not a long-term-memory route.

import { api } from "../../../shell/api";

/** As the endpoint answers: the card's own JSON arrives as a string field, and
 *  `name` is only sometimes hoisted out of it. `model/character.ts` reads it. */
export interface CharacterRow { id: string; data?: string; name?: string }

/** An empty list rather than a shape nobody can use. */
export const fetchCharacters = async (): Promise<CharacterRow[]> => {
  const r = await api<CharacterRow[]>("/characters");
  return Array.isArray(r) ? r : [];
};
