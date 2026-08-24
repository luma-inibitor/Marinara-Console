// Toast queue with undo support (DESIGN.md: undo over confirm).
// A toast with an action holds a pending commit: commit fires when the toast
// expires; the action (Undo) cancels it.
import { signal } from "@preact/signals";
import { useEffect, useState } from "preact/hooks";
import { Close, ICON_SIZE } from "../ui/icons";
import { t } from "../copy";

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

const toasts = signal<Toast[]>([]);
let seq = 0;
const timers = new Map<number, ReturnType<typeof setTimeout>>();

const UNDO_MS = 9_000;     // long enough to notice and act on a delete
const ERROR_MS = 8_000;
const INFO_MS = 4_000;

function remove(id: number, expired: boolean) {
  const t = toasts.value.find((x) => x.id === id);
  if (!t) return;
  clearTimeout(timers.get(id));
  timers.delete(id);
  toasts.value = toasts.value.filter((x) => x.id !== id);
  if (expired) t.onExpire?.();
}

export function toast(message: string, opts: Partial<Omit<Toast, "id" | "message" | "count" | "expiresAt">> = {}) {
  // Coalesce a repeat of the same message — a dropped connection fails every
  // pending write at once, and N identical toasts bury the one useful fact.
  // Never coalesce undoable toasts: each holds a distinct pending commit.
  if (!opts.onExpire && !opts.onAction) {
    const dup = toasts.value.find((t) => t.message === message && t.kind === (opts.kind ?? "info"));
    if (dup) {
      const ttl = (opts.kind === "error" ? ERROR_MS : INFO_MS);
      clearTimeout(timers.get(dup.id));
      timers.set(dup.id, setTimeout(() => remove(dup.id, true), ttl));
      toasts.value = toasts.value.map((t) =>
        t.id === dup.id ? { ...t, count: t.count + 1, expiresAt: Date.now() + ttl } : t);
      return dup.id;
    }
  }

  const id = ++seq;
  const ttl = opts.onExpire ? UNDO_MS : opts.kind === "error" ? ERROR_MS : INFO_MS;
  toasts.value = [...toasts.value, {
    id, message, kind: opts.kind ?? "info", count: 1, expiresAt: Date.now() + ttl, ...opts,
  }];
  timers.set(id, setTimeout(() => remove(id, true), ttl));
  return id;
}

/** Seconds left, ticking, so a pending delete shows its own deadline. */
function useCountdown(expiresAt: number): number {
  const [left, setLeft] = useState(() => Math.max(0, Math.ceil((expiresAt - Date.now()) / 1000)));
  useEffect(() => {
    const t = setInterval(() => setLeft(Math.max(0, Math.ceil((expiresAt - Date.now()) / 1000))), 250);
    return () => clearInterval(t);
  }, [expiresAt]);
  return left;
}

function ToastRow({ t: item }: { t: Toast }) {
  const undoable = !!item.onExpire;
  const left = useCountdown(item.expiresAt);
  return (
    <div className={`toast ${item.kind === "error" ? "is-error" : ""} ${undoable ? "is-undoable" : ""}`}>
      <span className="toast-msg">
        {item.message}
        {item.count > 1 && <span className="toast-count t-data">×{item.count}</span>}
      </span>
      {item.actionLabel && (
        <button className="toast-action" onClick={() => { item.onAction?.(); remove(item.id, false); }}>
          {item.actionLabel}{undoable && left > 0 && <span className="toast-left t-data">{left}s</span>}
        </button>
      )}
      {/* No dismiss on an undoable toast: dismissing it would have to either
          commit or cancel, and a "×" reads as cancel while committing. */}
      {!undoable && (
        <button className="toast-x" aria-label={t("shell.toast.dismiss")} onClick={() => remove(item.id, false)}>
          <Close size={ICON_SIZE.xl} stroke={1.75} aria-hidden />
        </button>
      )}
    </div>
  );
}

export function Toaster() {
  return (
    <div className="toaster" role="status" aria-live="polite">
      {toasts.value.map((t) => <ToastRow key={t.id} t={t} />)}
    </div>
  );
}
