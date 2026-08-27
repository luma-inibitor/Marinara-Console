// A character as the scope picker needs it: an id and a name to show. The host
// buries the name in a JSON string field and only sometimes hoists it out, so
// getting it is a transform rather than a wire shape.

import type { CharacterRow } from "../api/characters";

export interface Character {
  id: string;
  name: string;
}

/** Falls back to the id rather than to a blank: an unparseable card is still a
 *  character the reviewer may want to scope to. */
export function parseCharacter(c: CharacterRow): Character {
  if (c.name) return { id: c.id, name: c.name };
  try {
    return { id: c.id, name: (JSON.parse(c.data ?? "{}") as { name?: string }).name ?? c.id };
  } catch {
    return { id: c.id, name: c.id };
  }
}
