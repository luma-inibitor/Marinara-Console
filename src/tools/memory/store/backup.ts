// Where a screen reads the restore point's address. The browser downloads the
// file itself, so there is no request to own and nothing to hold — but the URL
// is still the endpoints layer's fact, and a screen reaching into `api/` for a
// href is the same bypass as one reaching in for a fetch.

export { backupExportUrl } from "../api/backup";
