// The host's chats. Not a long-term-memory route — scope names a chat the
// engine already knows about, so this hangs off the app's own API root.

import * as v from "valibot";
import { api } from "../../../shell/api";
import { parseItems } from "../../../shell/wire";

/** `characterIds` is what the scope cascade narrows on: choosing a character
 *  leaves only the chats that name it. The host writes an absent field as
 *  `null` rather than leaving it off. */
export const ChatSchema = v.looseObject({
  id: v.pipe(v.string(), v.minLength(1)),
  name: v.nullish(v.string()),
  mode: v.nullish(v.string()),
  characterIds: v.optional(v.array(v.string())),
});

export type Chat = v.InferOutput<typeof ChatSchema>;

/** The endpoint has answered with both a bare array and `{ items }`; the
 *  caller should not have to know which. */
export const fetchChats = async (): Promise<Chat[]> => {
  const r = await api<unknown>("/chats");
  const list = Array.isArray(r) ? r : (r as { items?: unknown }).items ?? [];
  return parseItems(ChatSchema, list, "GET /chats");
};
