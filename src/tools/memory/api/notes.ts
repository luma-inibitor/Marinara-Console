// Stored memories: read, correct, archive, re-extract.

import { api } from "../../../shell/api";
import { parseItems, parseWire, parseWrite } from "../../../shell/wire";
import { LTM } from "./routes";
import { ExtractResponseSchema, NoteArchiveSchema, NoteSchema, NoteWriteSchema } from "./schema";
import type { ExtractResponse, Note, NoteArchive } from "./types";

export const fetchNotes = async (query: Record<string, string | number> = {}): Promise<Note[]> => {
  const qs = new URLSearchParams(Object.entries(query).map(([k, v]) => [k, String(v)])).toString();
  const path = `${LTM}/notes${qs ? `?${qs}` : ""}`;
  return parseItems(NoteSchema, await api(path), `GET ${LTM}/notes`);
};
export const fetchNote = async (id: string): Promise<Note> =>
  parseWire(NoteSchema, await api(`${LTM}/notes/${id}`), `GET ${LTM}/notes/:id`);

/** Unwrapping the `{note, rebuild}` envelope here keeps it out of the store,
 *  which stores memories. */
export const patchNote = async (id: string, patch: Record<string, unknown>): Promise<Note> =>
  parseWrite(
    NoteWriteSchema,
    await api(`${LTM}/notes/${id}`, { method: "PATCH", body: patch }),
    `PATCH ${LTM}/notes/:id`,
  ).note;

/** Permanent removal is `POST /notes/permanent-delete`, which this console does
 *  not call: DELETE only archives. */
export const deleteNote = async (id: string): Promise<NoteArchive> =>
  parseWrite(NoteArchiveSchema, await api(`${LTM}/notes/${id}`, { method: "DELETE" }), `DELETE ${LTM}/notes/:id`);

export const extractNote = async (id: string, body: Record<string, unknown> = {}): Promise<ExtractResponse> =>
  parseWrite(
    ExtractResponseSchema,
    await api(`${LTM}/notes/${id}/extract`, { method: "POST", body }),
    `POST ${LTM}/notes/:id/extract`,
  );
