// A character, as the scope picker needs it: an id and a name to show.
//
// The host answers with the card's JSON in a string field and only sometimes
// hoists the name out of it, so reading that name is a transform rather than a
// wire shape — and a card that will not parse still has to name itself, or the
// picker lists a blank row nobody can choose.

import type { CharacterRow } from "../api/types";

export interface Character { id: string; name: string }

/** Falls back to the id rather than to a blank: an unparseable card is still a
 *  character the reviewer may want to scope to. */
export function parseCharacter(c: CharacterRow): Character {
  if (c.name) return { id: c.id, name: c.name };
  try { return { id: c.id, name: (JSON.parse(c.data ?? "{}") as { name?: string }).name ?? c.id }; }
  catch { return { id: c.id, name: c.id }; }
}
