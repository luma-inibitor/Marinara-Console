// Owns the notes: the loaded memories keyed by id, the vault lines derived
// from them, and the fetch that produces both. One owner, so two screens
// cannot each hold a copy of the same record and disagree about it.

import { createStore } from "../../../lib/store";
import type { Note } from "../api/types";
import { fetchNotes } from "../api/notes";
import type { VaultLine } from "../model/derived";

export const notesById = createStore<Map<string, Note>>(new Map());
export const lines = createStore<VaultLine[]>([]);

/** Returns the promise rather than awaiting it, so a caller loading notes
 *  alongside the review queue can still run both requests concurrently. */
export function loadAllNotes(): Promise<Note[]> {
  return fetchNotes({ limit: 500 }).catch(() => [] as Note[]);
}
