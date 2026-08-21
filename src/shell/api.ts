// API client: everything goes through server.mjs (/api proxy → engine, with
// embedding strip). Matches the engine's conventions: cache no-store, JSON.
export async function api<T = unknown>(path: string, opts: Omit<RequestInit, "body"> & { body?: unknown } = {}): Promise<T> {
  const { body, ...rest } = opts;
  const res = await fetch(`/api${path}`, {
    ...rest,
    headers: body !== undefined ? { "content-type": "application/json" } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
    cache: "no-store",
  });
  if (!res.ok) {
    let detail = "";
    try { detail = ((await res.json()) as { error?: string })?.error ?? ""; } catch { /* not json */ }
    throw new Error(`${res.status} ${res.statusText}${detail ? ` — ${detail}` : ""}`);
  }
  return res.status === 204 ? (null as T) : ((await res.json()) as T);
}

/** Engine-faithful token estimate — approximateTokens() in packages/shared. */
export const tokensOf = (text: string | null | undefined): number =>
  Math.ceil((text ?? "").length / 4);
