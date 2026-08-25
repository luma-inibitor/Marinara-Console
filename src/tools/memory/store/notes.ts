// Owns the notes: the loaded memories keyed by id, the vault lines derived
// from them, and the fetch that produces both. One owner, so two screens
// cannot each hold a copy of the same record and disagree about it.
//
// Every write to a note goes through an action here, which performs the
// request and then updates the map, so anything showing the record follows.
// Actions throw on failure; the copy for the toast belongs to the screen.

import { createStore, derived } from "../../../lib/store";
import type { Note, NoteSection } from "../api/types";
import { deleteNote, extractNote, fetchNote, fetchNotes, patchNote } from "../api/notes";
import type { VaultLine } from "../model/derived";

export const notesById = createStore<Map<string, Note>>(new Map());
export const lines = createStore<VaultLine[]>([]);

/** Every loaded memory, unscoped: a screen narrows this to its own scope, and
 *  the tallies beside it read the same unscoped set. */
export const allNotes = derived([notesById], (byId) => [...byId.values()]);

export const notesLoaded = createStore(false);
export const notesError = createStore<string | null>(null);

/** The memory a reference was followed into. Read-only, and deliberately not
 *  merged into `notesById`: a peek can reach a note the vault never fetched. */
export const peeked = createStore<Note | null>(null);

/** Returns the promise rather than awaiting it, so a caller loading notes
 *  alongside the review queue can still run both requests concurrently. */
export function loadAllNotes(): Promise<Note[]> {
  return fetchNotes({ limit: 500 }).catch(() => [] as Note[]);
}

/** Merged rather than replaced: the review queue's index is the same map, and
 *  a note fetched elsewhere must not be evicted by this write.
 *
 *  Throws on anything without a usable id rather than keying it under
 *  `undefined`: the map is shared, a junk entry reaches every screen reading
 *  it, and it outlives the write that made it because loadNotes merges. A
 *  failed write surfaces as an error the screen can report; a poisoned map
 *  surfaces as a crash somewhere else entirely. */
export function putNote(note: Note) {
  if (!note || typeof note.id !== "string" || note.id === "") {
    throw new TypeError("Refusing to store a memory without an id.");
  }
  notesById.set(new Map(notesById.get()).set(note.id, note));
}

/** Load every memory into the index. Reloading never clears `notesLoaded`, so
 *  a refresh after a write does not throw the screen back to its spinner. */
export async function loadNotes(): Promise<void> {
  try {
    const fetched = await fetchNotes({ limit: 500 });
    notesById.set(new Map([...notesById.get(), ...fetched.map((n) => [n.id, n] as const)]));
    notesError.set(null);
    notesLoaded.set(true);
  } catch (error) {
    notesError.set((error as Error).message);
  }
}

async function writeNote(id: string, patch: Record<string, unknown>): Promise<void> {
  putNote(await patchNote(id, patch));
  await loadNotes();
}

/** Replace the edited section text on one memory. */
export function saveNoteSections(id: string, sections: Record<string, NoteSection>): Promise<void> {
  return writeNote(id, { sections });
}

/** Optimistic: the new status shows before the request settles, and the old
 *  one goes back if it fails. Low risk, and recoverable either way. */
export async function setNoteStatus(id: string, status: Note["status"]): Promise<void> {
  const previous = notesById.get().get(id);
  if (previous) putNote({ ...previous, status });
  try {
    await writeNote(id, { status });
  } catch (error) {
    if (previous) putNote(previous);
    throw error;
  }
}

/** Undoable: pass the old status back to `setNoteStatus` to put the memory
 *  back where it was. */
export function archiveNote(id: string): Promise<void> {
  return setNoteStatus(id, "archived");
}

/** Archives the memory together with everything extracted from it, and returns
 *  every note archived. Each one is stored rather than dropped: dropping the
 *  target leaves the memories extracted from it in the map still reading
 *  `active`. */
export async function archiveNoteWithExtracted(id: string): Promise<Note[]> {
  const { notes } = await deleteNote(id);
  const archived = notes ?? [];
  for (const note of archived) putNote(note);
  return archived;
}

/** Run extraction over a source memory again. What it produces is drafts, which
 *  belong to the review queue rather than to this index — so nothing here
 *  changes, and the caller refreshes the queue when its batch is done. Throws;
 *  the copy for the toast belongs to the screen. */
export async function reextractSource(id: string): Promise<void> {
  await extractNote(id);
}

export async function openPeek(id: string): Promise<void> {
  // A chained peek replaces content inside the same <Sheet>, which stays
  // mounted, so it does not push a second history entry — one back closes
  // the peek however deep you followed the links.
  peeked.set(await fetchNote(id));
}

export function closePeek() {
  peeked.set(null);
}
