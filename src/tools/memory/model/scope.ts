// What the scope bar actually selects.
//
// Scope is a location — character › chat — and it decides what every memory
// view shows, not just what an import writes. One predicate, so the vault and
// the review queue can never disagree about whether a memory belongs here.
//
// Two rules carry it:
//
//   An UNSCOPED memory is available everywhere. The catalog defines scope as
//   "chats, branches, characters, or personas where this memory is available"
//   (memoryvault.chatsBridges…), so an empty scope is not "belongs nowhere",
//   it is "belongs to all of them". Imported lorebook sources arrive this way
//   and would otherwise vanish the moment a scope was picked.
//
//   A record we cannot place is shown, not hidden. Filtering is a convenience;
//   silently hiding something because its note has not loaded yet would make
//   the queue lie about how much work is left.

import type { Note } from "../api/types";
import type { Row } from "./review";

export interface Scope {
  characterId: string;
  chatId: string;
}

/** False when nothing is selected — every view shows everything. */
export function isScoped(scope: Scope): boolean {
  return Boolean(scope.characterId || scope.chatId);
}

/** The ids a note declares itself available in. The engine writes both the
 *  singular and the plural of each (`chatId` beside `chatIds`), so both are
 *  read rather than trusting one to be present. */
function idsIn(scope: unknown, singular: string, plural: string): string[] {
  if (!scope || typeof scope !== "object") return [];
  const s = scope as Record<string, unknown>;
  const out: string[] = [];
  if (typeof s[singular] === "string" && s[singular]) out.push(s[singular] as string);
  if (Array.isArray(s[plural])) for (const v of s[plural] as unknown[]) if (typeof v === "string" && v) out.push(v);
  return out;
}

export function noteInScope(note: Note | undefined, scope: Scope): boolean {
  if (!isScoped(scope)) return true;
  if (!note) return true; // cannot place it: show it
  const chats = idsIn(note.scope, "chatId", "chatIds");
  const characters = idsIn(note.scope, "characterId", "characterIds");
  // Available everywhere.
  if (!chats.length && !characters.length) return true;
  // The chat is the narrower level and cascades within its character, so when
  // one is chosen it is the one that decides.
  if (scope.chatId && chats.length) return chats.includes(scope.chatId);
  if (scope.characterId && characters.length) return characters.includes(scope.characterId);
  // Scoped, but not on the level being filtered — that level does not exclude it.
  return true;
}

/** A review row belongs to the memory it writes to; a row proposing a NEW
 *  memory has no stored target yet, so it inherits the scope of the source it
 *  was extracted from. */
export function rowInScope(row: Row, byId: Map<string, Note>, scope: Scope): boolean {
  if (!isScoped(scope)) return true;
  const target = byId.get(row.targetId);
  if (target) return noteInScope(target, scope);
  const source = byId.get(row.sourceNoteId);
  return noteInScope(source, scope);
}
