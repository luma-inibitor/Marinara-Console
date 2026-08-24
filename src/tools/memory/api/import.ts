// Turning outside material into source notes the engine can extract from.

import { api } from "../../../shell/api";
import { LTM } from "./routes";
import type { ImportPreview, ImportResult } from "./types";

export const importPreview = (source: string) =>
  api<ImportPreview>(`${LTM}/import/preview`, { method: "POST", body: { source } });
export const importSourceNotes = (body: Record<string, unknown>) =>
  api<ImportResult>(`${LTM}/import/source-notes`, { method: "POST", body });
