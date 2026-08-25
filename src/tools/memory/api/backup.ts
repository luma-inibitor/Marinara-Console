// The whole vault as a file. A URL rather than a fetch: the browser downloads
// it directly, so the payload never passes through the console.

import { urlFor } from "./client";

export const backupExportUrl = () => urlFor("GET /backup/export");
