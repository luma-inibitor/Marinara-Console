// The host's chats. Not a long-term-memory route — scope names a chat the
// engine already knows about, so this hangs off the app's own API root.

import { call } from "./client";
import type { Chat } from "./types";

/** The endpoint has answered with both a bare array and `{ items }`; the
 *  caller should not have to know which, and the table's `unwrap` is where
 *  that is settled. */
export const fetchChats = (): Promise<Chat[]> => call("GET /chats");
