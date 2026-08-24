// Connection state — persistent, not a toast. The link drops routinely (phone
// over Tailscale, engine in Termux), so this is a normal state, not an edge case.
//
// Two stores, because neither alone is right: the browser's own online/offline
// events catch airplane mode and Wi-Fi loss, but say nothing about the engine
// being asleep — for that we watch actual request outcomes.
import { createStore, derived, useStore, type Store } from "../lib/store";
import { ApiError } from "./api";
import { t } from "../copy";

export type Reach = "ok" | "offline" | "engine-down";

const browserOnline = createStore(navigator.onLine);
const engineReachable = createStore(true);
/** Bumped by a successful request, so recovery is announced once. */
export const lastOk = createStore<number>(0);

export const reach: Store<Reach> = derived(
  [browserOnline, engineReachable],
  (online, engine) => (!online ? "offline" : engine ? "ok" : "engine-down"),
);

if (typeof window !== "undefined") {
  window.addEventListener("online", () => { browserOnline.set(true); void probe(); });
  window.addEventListener("offline", () => { browserOnline.set(false); });
}

/** Record the outcome of a real request — the honest signal. */
export function noteResult(err: unknown | null) {
  if (err == null) {
    engineReachable.set(true);
    lastOk.set(Date.now());
    return;
  }
  if (err instanceof ApiError && err.offline) engineReachable.set(false);
}

let probing = false;
let backoff = 1_000;

/** Poll the engine until it answers, with backoff. Safe to call repeatedly. */
export async function probe(): Promise<boolean> {
  if (probing) return engineReachable.get();
  probing = true;
  try {
    const res = await fetch("/api/lorebooks", { cache: "no-store" });
    if (res.ok) { engineReachable.set(true); lastOk.set(Date.now()); backoff = 1_000; return true; }
    return false;
  } catch { return false; }
  finally { probing = false; }
}

let timer: ReturnType<typeof setTimeout> | null = null;
/** Start reconnect attempts; stops once the engine answers. */
export function startReconnect() {
  if (timer) return;
  const tick = async () => {
    timer = null;
    if (reach.get() === "ok") { backoff = 1_000; return; }
    const ok = await probe();
    if (!ok) {
      backoff = Math.min(backoff * 2, 30_000);
      timer = setTimeout(tick, backoff);
    }
  };
  timer = setTimeout(tick, backoff);
}

/** Persistent banner. Says what still works, and what doesn't. */
export function ConnectionBanner() {
  const r = useStore(reach);
  if (r === "ok") return null;
  const offline = r === "offline";
  return (
    <div className="connbar" role="status" aria-live="polite">
      <span className="connbar-dot" aria-hidden="true" />
      <span className="connbar-text">
        <b>{offline ? t("shell.conn.offlineTitle") : t("shell.conn.engineTitle")}</b>
        {" — "}
        {offline ? t("shell.conn.offlineBody") : t("shell.conn.engineBody")}
      </span>
      <button className="connbar-btn" onClick={() => void probe()}>{t("shell.conn.retry")}</button>
    </div>
  );
}
