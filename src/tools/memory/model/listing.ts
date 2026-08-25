// What the vault's default list is made of.

import type { Note } from "../api/types";

/** Whether the vault's default list shows this memory. Archived memories are
 *  not listed; every other status is. */
export function listedInVault(note: Note): boolean {
  return note.status !== "archived";
}
