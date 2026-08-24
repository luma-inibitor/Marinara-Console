// Stored memories: read, correct, remove, re-extract.

import { api } from "../../../shell/api";
import { LTM } from "./routes";
import type { Note } from "./types";

export const fetchNotes = (query: Record<string, string | number> = {}) => {
  const qs = new URLSearchParams(Object.entries(query).map(([k, v]) => [k, String(v)])).toString();
  return api<Note[]>(`${LTM}/notes${qs ? `?${qs}` : ""}`);
};
export const fetchNote = (id: string) => api<Note>(`${LTM}/notes/${id}`);
export const patchNote = (id: string, patch: Record<string, unknown>) =>
  api<Note>(`${LTM}/notes/${id}`, { method: "PATCH", body: patch });
export const deleteNote = (id: string) => api(`${LTM}/notes/${id}`, { method: "DELETE" });
export const extractNote = (id: string, body: Record<string, unknown> = {}) =>
  api(`${LTM}/notes/${id}/extract`, { method: "POST", body });
