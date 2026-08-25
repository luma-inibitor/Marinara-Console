// Owns the selected scope: the two stores every memory screen reads, and the
// only sanctioned way to change them.
//
// Scope is not only a filter — the engine records it into a draft's extraction
// context, so changing it after an extraction is what makes drafts go stale.
// The stores live here rather than in the review store because scope is not
// review state: the vault and the sources workspace answer to it too.

import { createStore, useStore } from "../../../lib/store";
import type { Scope } from "../model/scope";

/** Import scope: one value read by every memory screen, tool-level rather than
 *  console-wide. */
export const scopeChatId = createStore<string>(localStorage.getItem("mc-ltm-chat") ?? "");
export const scopeCharacterId = createStore<string>(localStorage.getItem("mc-ltm-character") ?? "");

export function setScope(id: string) {
  scopeChatId.set(id);
  localStorage.setItem("mc-ltm-chat", id);
}

/** Choosing a character narrows the chats below it, so a chat that no longer
 *  belongs to the scope cannot stay selected. */
export function setScopeCharacter(id: string) {
  scopeCharacterId.set(id);
  localStorage.setItem("mc-ltm-character", id);
  if (id) setScope("");
}

/** The scope every memory view reads. */
export function useScope(): Scope {
  return { characterId: useStore(scopeCharacterId), chatId: useStore(scopeChatId) };
}

export function currentScope(): Scope {
  return { characterId: scopeCharacterId.get(), chatId: scopeChatId.get() };
}
