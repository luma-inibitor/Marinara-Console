// The whole vault as a file. A URL rather than a fetch: the browser downloads
// it directly, so the payload never passes through the console — which is why
// there is no schema here and nothing for one to check.

import { LTM } from "./routes";

export const backupExportUrl = () => `/api${LTM}/backup/export`;
