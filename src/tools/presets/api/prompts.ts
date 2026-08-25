// The prompt-preset routes: the presets, one preset whole, and its sections.
/* @copy-strict */
import * as v from "valibot";
import { api } from "../../../shell/api";
import { parseItems, parseWire, parseWrite } from "../../../shell/wire";
import { PresetFullSchema, PresetSchema, SectionSchema } from "./schema";

/** Two arguments because @copy-strict reads "GET /x" as copy. */
const wire = (method: string, path: string) => `${method} ${path}`;

export const fetchPresets = async () =>
  parseItems(PresetSchema, await api("/prompts"), wire("GET", "/prompts"));

export const fetchFull = async (presetId: string) =>
  parseWire(PresetFullSchema, await api(`/prompts/${presetId}/full`), wire("GET", "/prompts/:id/full"));

export const patchPreset = (presetId: string, patch: Record<string, unknown>) =>
  api(`/prompts/${presetId}`, { method: "PATCH", body: patch });

/** `nullish` because the route may answer 204 rather than the saved section. */
export const patchSection = async (presetId: string, sectionId: string, patch: Record<string, unknown>) =>
  parseWrite(v.nullish(SectionSchema), await api(`/prompts/${presetId}/sections/${sectionId}`, { method: "PATCH", body: patch }), wire("PATCH", "/prompts/:id/sections/:sectionId"));
export const createSection = async (presetId: string, body: Record<string, unknown>) =>
  parseWrite(SectionSchema, await api(`/prompts/${presetId}/sections`, { method: "POST", body }), wire("POST", "/prompts/:id/sections"));
export const deleteSection = (presetId: string, sectionId: string) =>
  api<null>(`/prompts/${presetId}/sections/${sectionId}`, { method: "DELETE" });
export const duplicatePreset = async (presetId: string) =>
  parseWrite(PresetSchema, await api(`/prompts/${presetId}/duplicate`, { method: "POST" }), wire("POST", "/prompts/:id/duplicate"));
export const setDefaultPreset = (id: string) =>
  api(`/prompts/${id}/set-default`, { method: "POST" });
