// Stored memories: read, correct, archive, re-extract.

import { api } from "../../../shell/api";
import { LTM } from "./routes";
import type { Note } from "./types";

export const fetchNotes = (query: Record<string, string | number> = {}) => {
  const qs = new URLSearchParams(Object.entries(query).map(([k, v]) => [k, String(v)])).toString();
  return api<Note[]>(`${LTM}/notes${qs ? `?${qs}` : ""}`);
};
export const fetchNote = (id: string) => api<Note>(`${LTM}/notes/${id}`);

/** Every write route wraps the saved note beside the index rebuild it kicked
 *  off — `{note, rebuild}`, never a bare note. Unwrapping here keeps the
 *  envelope out of the store, which stores memories. */
interface NoteWrite { note: Note; rebuild?: unknown }
/** DELETE archives the note and everything extracted from it — nothing is
 *  removed — so the reply carries the whole set it archived. Permanent removal
 *  is a different route (`POST /notes/permanent-delete`), which this console
 *  does not call. */
interface NoteDelete { archived: boolean; note: Note; notes: Note[]; rebuild?: unknown }

export const patchNote = async (id: string, patch: Record<string, unknown>): Promise<Note> =>
  (await api<NoteWrite>(`${LTM}/notes/${id}`, { method: "PATCH", body: patch })).note;
export const deleteNote = (id: string) => api<NoteDelete>(`${LTM}/notes/${id}`, { method: "DELETE" });
export const extractNote = (id: string, body: Record<string, unknown> = {}) =>
  api<NoteWrite>(`${LTM}/notes/${id}/extract`, { method: "POST", body });
