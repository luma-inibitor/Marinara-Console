// Stored memories: read, correct, archive, re-extract.

import { call } from "./client";
import type { ExtractResponse, Note, NoteArchive } from "./types";

export const fetchNotes = (query: Record<string, string | number> = {}): Promise<Note[]> =>
  call("GET /notes", { query });

export const fetchNote = (id: string): Promise<Note> =>
  call("GET /notes/:id", { params: { id } });

/** Unwrapping the `{note, rebuild}` envelope here keeps it out of the store,
 *  which stores memories. */
export const patchNote = async (id: string, patch: Record<string, unknown>): Promise<Note> =>
  (await call("PATCH /notes/:id", { params: { id }, body: patch })).note;

/** Permanent removal is `POST /notes/permanent-delete`, which this console does
 *  not call: DELETE only archives. */
export const deleteNote = (id: string): Promise<NoteArchive> =>
  call("DELETE /notes/:id", { params: { id } });

export const extractNote = (id: string, body: Record<string, unknown> = {}): Promise<ExtractResponse> =>
  call("POST /notes/:id/extract", { params: { id }, body });
