// Turning outside material into source notes the engine can extract from.
//
// The preview is a read in POST clothing, so it parses as one; the import
// itself is all or nothing.

import { api } from "../../../shell/api";
import { parseWire, parseWrite } from "../../../shell/wire";
import { LTM } from "./routes";
import { ImportPreviewSchema, ImportResultSchema } from "./schema";
import type { ImportPreview, ImportResult } from "./types";

export const importPreview = async (source: string): Promise<ImportPreview> =>
  parseWire(ImportPreviewSchema, await api(`${LTM}/import/preview`, { method: "POST", body: { source } }), `POST ${LTM}/import/preview`);

export const importSourceNotes = async (body: Record<string, unknown>): Promise<ImportResult> =>
  parseWrite(ImportResultSchema, await api(`${LTM}/import/source-notes`, { method: "POST", body }), `POST ${LTM}/import/source-notes`);
