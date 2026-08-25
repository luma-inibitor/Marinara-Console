// The host's characters. Like /chats, not a long-term-memory route: scope
// names a character the engine already knows about.

import { call } from "./client";
import type { CharacterRow } from "./types";

/** An empty list rather than a shape nobody can use, for the same reason
 *  `fetchChats` normalises its two: the caller should not have to know. */
export const fetchCharacters = (): Promise<CharacterRow[]> => call("GET /characters");
