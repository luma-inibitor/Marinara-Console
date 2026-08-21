// Toast queue with undo support (DESIGN.md: undo over confirm).
// A toast with an action holds a pending commit: commit fires when the toast
// expires or is dismissed; the action (Undo) cancels it.
import { signal } from "@preact/signals";

export interface Toast {
  id: number;
  message: string;
  kind: "info" | "error";
  actionLabel?: string;
  onAction?: () => void;
  onExpire?: () => void;
}

const toasts = signal<Toast[]>([]);
let seq = 0;
const timers = new Map<number, ReturnType<typeof setTimeout>>();

function remove(id: number, expired: boolean) {
  const t = toasts.value.find((x) => x.id === id);
  if (!t) return;
  clearTimeout(timers.get(id));
  timers.delete(id);
  toasts.value = toasts.value.filter((x) => x.id !== id);
  if (expired) t.onExpire?.();
}

export function toast(message: string, opts: Partial<Omit<Toast, "id" | "message">> = {}) {
  const id = ++seq;
  toasts.value = [...toasts.value, { id, message, kind: opts.kind ?? "info", ...opts }];
  timers.set(id, setTimeout(() => remove(id, true), opts.kind === "error" ? 6500 : 6000));
  return id;
}

export function Toaster() {
  return (
    <div class="toaster" role="status" aria-live="polite">
      {toasts.value.map((t) => (
        <div key={t.id} class={`toast ${t.kind === "error" ? "is-error" : ""}`}>
          <span class="toast-msg">{t.message}</span>
          {t.actionLabel && (
            <button
              class="toast-action"
              onClick={() => { t.onAction?.(); remove(t.id, false); }}
            >
              {t.actionLabel}
            </button>
          )}
          <button class="toast-x hit" aria-label="Dismiss" onClick={() => remove(t.id, true)}>×</button>
        </div>
      ))}
    </div>
  );
}
