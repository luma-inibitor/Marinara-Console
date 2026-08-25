// The console's own state, which `server.mjs` stores under /console/state/:key.
// Not the engine, so it does not go through the /api proxy and cannot use the
// client beside it — this is the second thing in the transport layer, and the
// only other place a `fetch` is allowed to live.
//
// Transport only: the key and the shape of the record belong to the module
// that keeps it. Reads hand back whatever the server parsed, and a failure of
// any kind — offline, 404, a body that is not JSON — rejects, because a caller
// restoring saved work has to tell "nothing stored" from "could not ask".

export async function readConsoleState<T>(key: string): Promise<T> {
  return (await (await fetch(`/console/state/${key}`)).json()) as T;
}

/** Resolves to whether the server accepted it; rejects only when the request
 *  never completed. `keepalive` is for the page-hide flush, where the document
 *  is going away before the response can arrive. */
export async function writeConsoleState(
  key: string,
  value: unknown,
  opts: { keepalive?: boolean } = {},
): Promise<boolean> {
  const res = await fetch(`/console/state/${key}`, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    keepalive: opts.keepalive,
    body: JSON.stringify(value),
  });
  return res.ok;
}
