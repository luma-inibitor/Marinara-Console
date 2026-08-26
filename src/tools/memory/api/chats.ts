// The host's chats. Not a long-term-memory route: scope names a chat the engine
// already knows about.

import { api } from "../../../shell/api";

/** `characterIds` is what the scope cascade narrows on: choosing a character
 *  leaves only the chats that name it. */
export interface Chat { id: string; name?: string; mode?: string; characterIds?: string[] }

/** The endpoint has answered with both a bare array and `{ items }`; the
 *  caller should not have to know which. */
export const fetchChats = async (): Promise<Chat[]> => {
  const r = await api<Chat[] | { items?: Chat[] }>("/chats");
  return Array.isArray(r) ? r : r.items ?? [];
};
