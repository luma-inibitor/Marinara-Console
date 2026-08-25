// Turning outside material into source notes the engine can extract from.
// The preview is a POST that scans and writes nothing, so it parses as a read.

import { call } from "./client";
import type { ImportPreview, ImportResult } from "./types";

export const importPreview = (source: string): Promise<ImportPreview> =>
  call("POST /import/preview", { body: { source } });

export const importSourceNotes = (body: Record<string, unknown>): Promise<ImportResult> =>
  call("POST /import/source-notes", { body });
