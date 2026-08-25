// The lorebook routes: the books, and one book's entries.
/* @copy-strict */
import * as v from "valibot";
import { api } from "../../../shell/api";
import { parseItems, parseWrite } from "../../../shell/wire";
import { EntrySchema, LorebookSchema } from "./schema";

/** Two arguments because @copy-strict reads "GET /x" as copy. */
const wire = (method: string, path: string) => `${method} ${path}`;

export const fetchBooks = async () =>
  parseItems(LorebookSchema, await api("/lorebooks"), wire("GET", "/lorebooks"));
export const fetchEntries = async (bookId: string) =>
  parseItems(EntrySchema, await api(`/lorebooks/${bookId}/entries`), wire("GET", "/lorebooks/:id/entries"));

/** `nullish` because the route may answer 204 rather than the saved row. */
export const patchEntry = async (bookId: string, entryId: string, patch: Record<string, unknown>) =>
  parseWrite(v.nullish(EntrySchema), await api(`/lorebooks/${bookId}/entries/${entryId}`, { method: "PATCH", body: patch }), wire("PATCH", "/lorebooks/:id/entries/:entryId"));
export const createEntry = async (bookId: string, body: Record<string, unknown>) =>
  parseWrite(EntrySchema, await api(`/lorebooks/${bookId}/entries`, { method: "POST", body }), wire("POST", "/lorebooks/:id/entries"));
export const deleteEntry = (bookId: string, id: string) =>
  api<null>(`/lorebooks/${bookId}/entries/${id}`, { method: "DELETE" });
export const bulkPatch = (bookId: string, entryIds: string[], changes: Record<string, unknown>) =>
  api(`/lorebooks/${bookId}/entries/bulk`, { method: "PATCH", body: { entryIds, changes } });
