// Connection state — persistent, not a toast.
//
// The owner runs this from a phone over Tailscale against an engine hosted in
// Termux. The link dropping is a routine event, not an edge case, and the app
// previously had no handling at all: no banner, N independent failures, nothing
// retried, and an offline reload was a blank white page.
//
// Two signals, because neither alone is right: the browser's own online/offline
// events catch airplane mode and Wi-Fi loss, but say nothing about the engine
// being asleep — for that we watch actual request outcomes.
import { signal, computed } from "@preact/signals";
import { ApiError } from "./api";

export type Reach = "ok" | "offline" | "engine-down";

const browserOnline = signal(navigator.onLine);
const engineReachable = signal(true);
/** Bumped by a successful request, so recovery is announced once. */
export const lastOk = signal<number>(0);

export const reach = computed<Reach>(() =>
  !browserOnline.value ? "offline" : engineReachable.value ? "ok" : "engine-down");

if (typeof window !== "undefined") {
  window.addEventListener("online", () => { browserOnline.value = true; void probe(); });
  window.addEventListener("offline", () => { browserOnline.value = false; });
}

/** Record the outcome of a real request — the honest signal. */
export function noteResult(err: unknown | null) {
  if (err == null) {
    engineReachable.value = true;
    lastOk.value = Date.now();
    return;
  }
  if (err instanceof ApiError && err.offline) engineReachable.value = false;
}

let probing = false;
let backoff = 1_000;

/** Poll the engine until it answers, with backoff. Safe to call repeatedly. */
export async function probe(): Promise<boolean> {
  if (probing) return engineReachable.value;
  probing = true;
  try {
    const res = await fetch("/api/lorebooks", { cache: "no-store" });
    if (res.ok) { engineReachable.value = true; lastOk.value = Date.now(); backoff = 1_000; return true; }
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
    if (reach.value === "ok") { backoff = 1_000; return; }
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
  const r = reach.value;
  if (r === "ok") return null;
  const offline = r === "offline";
  return (
    <div class="connbar" role="status" aria-live="polite">
      <span class="connbar-dot" aria-hidden="true" />
      <span class="connbar-text">
        <b>{offline ? "No network connection" : "Cannot reach the engine"}</b>
        {" — "}
        {offline
          ? "you can read what's already loaded; edits can't be saved until you're back."
          : "the engine may be asleep. Your unsaved edits are kept."}
      </span>
      <button class="connbar-btn" onClick={() => void probe()}>Retry now</button>
    </div>
  );
}
