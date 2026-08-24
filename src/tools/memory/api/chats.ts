// The host's chats. Not a long-term-memory route — scope names a chat the
// engine already knows about, so this hangs off the app's own API root.

import { api } from "../../../shell/api";

export interface Chat { id: string; name?: string; mode?: string }

/** The endpoint has answered with both a bare array and `{ items }`; the
 *  caller should not have to know which. */
export const fetchChats = async (): Promise<Chat[]> => {
  const r = await api<Chat[] | { items?: Chat[] }>("/chats");
  return Array.isArray(r) ? r : r.items ?? [];
};
