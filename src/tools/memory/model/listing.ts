// What the vault's default list is made of.
//
// Archiving is the vault's one tidying action, and `GET /notes` returns
// archived notes, so a memory used to sit in the list unchanged after being
// archived — which reads as the action having done nothing, and gets it used
// twice. Archived memories are therefore not listed.
//
// There is deliberately no way to bring them back into view. Richer vault
// filtering is a later redesign and this is not half of it.

import type { Note } from "../api/types";

/** Whether the vault's default list shows this memory.
 *
 *  Only archiving hides a memory. Resolved is not the same judgment: the
 *  engine can still recall a resolved memory depending on settings
 *  (memorysettings' "Allows resolved memories to participate in recall"), so
 *  it is a live record and the list has to keep showing it. */
export function listedInVault(note: Note): boolean {
  return note.status !== "archived";
}
