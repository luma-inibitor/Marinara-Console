// Stored memories: read, correct, archive, re-extract.

import { api } from "../../../shell/api";
import { parseItems, parseWire } from "../../../shell/wire";
import { LTM } from "./routes";
import { NoteSchema } from "./schema";
import type { Note } from "./types";

export const fetchNotes = async (query: Record<string, string | number> = {}): Promise<Note[]> => {
  const qs = new URLSearchParams(Object.entries(query).map(([k, v]) => [k, String(v)])).toString();
  const path = `${LTM}/notes${qs ? `?${qs}` : ""}`;
  return parseItems(NoteSchema, await api(path), `GET ${LTM}/notes`);
};
export const fetchNote = async (id: string): Promise<Note> =>
  parseWire(NoteSchema, await api(`${LTM}/notes/${id}`), `GET ${LTM}/notes/:id`);

/** Every write route wraps the saved note beside the index rebuild it kicked
 *  off — `{note, rebuild}`, never a bare note. Unwrapping here keeps the
 *  envelope out of the store, which stores memories. */
interface NoteWrite { note: Note; rebuild?: unknown }
/** DELETE archives the note and everything extracted from it, so the reply
 *  carries the whole set. Permanent removal is `POST /notes/permanent-delete`,
 *  which this console does not call. */
interface NoteDelete { archived: boolean; note: Note; notes: Note[]; rebuild?: unknown }

export const patchNote = async (id: string, patch: Record<string, unknown>): Promise<Note> =>
  (await api<NoteWrite>(`${LTM}/notes/${id}`, { method: "PATCH", body: patch })).note;
export const deleteNote = (id: string) => api<NoteDelete>(`${LTM}/notes/${id}`, { method: "DELETE" });
export const extractNote = (id: string, body: Record<string, unknown> = {}) =>
  api<NoteWrite>(`${LTM}/notes/${id}/extract`, { method: "POST", body });
