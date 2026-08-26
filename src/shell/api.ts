// API client: everything goes through server.mjs (/api proxy → engine, with
// embedding strip).
import { t } from "../copy";
import { toast } from "./toast";

/**
 * An error carrying what the engine actually said. The engine returns
 * `{error, details:[{path,message}]}` on validation failure; `details` carries
 * the per-field messages that inline validation needs.
 */
export class ApiError extends Error {
  status: number;
  details: Array<{ path?: string; message?: string }>;
  /** True when the request never reached the engine (offline, DNS, refused). */
  offline: boolean;
  constructor(message: string, opts: { status: number; details?: unknown; offline?: boolean }) {
    super(message);
    this.name = "ApiError";
    this.status = opts.status;
    this.details = Array.isArray(opts.details) ? opts.details as Array<{ path?: string; message?: string }> : [];
    this.offline = opts.offline ?? false;
  }
}

let restorePointWarned = false;

export async function api<T = unknown>(path: string, opts: Omit<RequestInit, "body"> & { body?: unknown } = {}): Promise<T> {
  const { body, ...rest } = opts;
  let res: Response;
  try {
    res = await fetch(`/api${path}`, {
      ...rest,
      headers: body !== undefined ? { "content-type": "application/json" } : undefined,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      cache: "no-store",
    });
  } catch (err) {
    // fetch rejects only on network failure — the browser never reached us.
    const e = new ApiError(t("shell.api.noConnection"), { status: 0, offline: true });
    onResult?.(e);
    throw e;
  }
  if (!restorePointWarned && res.headers.get("x-ltm-restore-point") === "failed") {
    restorePointWarned = true;
    toast(t("shell.api.restorePointFailed"), { kind: "error" });
  }
  if (!res.ok) {
    let payload: { error?: string; detail?: string; details?: unknown } = {};
    try { payload = (await res.json()) as typeof payload; } catch { /* not json */ }
    // The proxy returns 502 + {error, detail} when the engine itself is unreachable.
    const engineDown = res.status === 502;
    const msg = payload.error || payload.detail || `${res.status} ${res.statusText}`;
    const e = new ApiError(
      payload.detail && payload.error ? `${payload.error} (${payload.detail})` : msg,
      { status: res.status, details: payload.details, offline: engineDown },
    );
    onResult?.(e);
    throw e;
  }
  onResult?.(null);
  return res.status === 204 ? (null as T) : ((await res.json()) as T);
}

/**
 * Outcome hook, set once at startup. A callback rather than an import, so
 * api.ts stays free of UI dependencies.
 */
let onResult: ((err: unknown | null) => void) | null = null;
export const setResultHook = (fn: (err: unknown | null) => void) => { onResult = fn; };

/** Engine-faithful token estimate — approximateTokens() in packages/shared. */
export const tokensOf = (text: string | null | undefined): number =>
  Math.ceil((text ?? "").length / 4);
