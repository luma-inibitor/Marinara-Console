// The whole vault as a file. A URL rather than a fetch: the browser downloads
// it directly, so the payload never passes through the console.

import { LTM } from "./routes";

export const backupExportUrl = () => `/api${LTM}/backup/export`;
