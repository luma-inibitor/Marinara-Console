// Owns the toast queue: the store of live toasts, the `toast()` that enqueues
// one, and the timers that expire them. No markup — `Toaster.tsx` renders this.
//
// The queue is not presentation, and the split is what lets a store enqueue a
// toast without pointing upward at the screen that draws it (ARCHITECTURE.md §1).
//
// Undo over confirm (DESIGN.md): a toast with an action carries the undo. It
// comes in two shapes — the write is still pending in `onExpire` and Undo
// cancels it, or the write already landed and Undo reverses it — and both are
// undoable. `isUndoable` is the one place that decides, because the deadline
// and the countdown drawn against it must never disagree.
import { createStore } from "../lib/store";

export interface Toast {
  id: number;
  message: string;
  kind: "info" | "error";
  actionLabel?: string;
  onAction?: () => void;
  onExpire?: () => void;
  /** How many identical messages have collapsed into this one. */
  count: number;
  /** Epoch ms when this toast commits/disappears. */
  expiresAt: number;
}

export const toasts = createStore<Toast[]>([]);
let seq = 0;
const timers = new Map<number, ReturnType<typeof setTimeout>>();

const UNDO_MS = 9_000; // long enough to notice and act on a delete
const ERROR_MS = 8_000;
const INFO_MS = 4_000;

/** Whether Undo is on offer, and so whether this toast gets the long deadline
 *  and shows the countdown against it. */
export function isUndoable(t: Pick<Toast, "onAction" | "onExpire">): boolean {
  return !!(t.onAction ?? t.onExpire);
}

function remove(id: number, expired: boolean) {
  const t = toasts.get().find((x) => x.id === id);
  if (!t) return;
  clearTimeout(timers.get(id));
  timers.delete(id);
  toasts.update((list) => list.filter((x) => x.id !== id));
  if (expired) t.onExpire?.();
}

/** Take a toast off the queue without expiring it, so a pending commit is
 *  cancelled rather than fired. The only removal a renderer may ask for. */
export function dismissToast(id: number) {
  remove(id, false);
}

export function toast(message: string, opts: Partial<Omit<Toast, "id" | "message" | "count" | "expiresAt">> = {}) {
  // Coalesce a repeat of the same message — a dropped connection fails every
  // pending write at once, and N identical toasts bury the one useful fact.
  // Never coalesce undoable toasts: each carries a distinct undo.
  if (!isUndoable(opts)) {
    const dup = toasts.get().find((t) => t.message === message && t.kind === (opts.kind ?? "info"));
    if (dup) {
      const ttl = opts.kind === "error" ? ERROR_MS : INFO_MS;
      clearTimeout(timers.get(dup.id));
      timers.set(
        dup.id,
        setTimeout(() => remove(dup.id, true), ttl),
      );
      toasts.update((list) =>
        list.map((t) => (t.id === dup.id ? { ...t, count: t.count + 1, expiresAt: Date.now() + ttl } : t)),
      );
      return dup.id;
    }
  }

  const id = ++seq;
  const ttl = isUndoable(opts) ? UNDO_MS : opts.kind === "error" ? ERROR_MS : INFO_MS;
  toasts.update((list) => [
    ...list,
    {
      id,
      message,
      kind: opts.kind ?? "info",
      count: 1,
      expiresAt: Date.now() + ttl,
      ...opts,
    },
  ]);
  timers.set(
    id,
    setTimeout(() => remove(id, true), ttl),
  );
  return id;
}
