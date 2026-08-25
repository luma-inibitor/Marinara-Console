// Owns how the toast queue looks: the stack in the corner and one row per
// toast. It reads `toast.ts` and never enqueues anything itself.
import { useEffect, useState } from "react";
import { useStore } from "../lib/store";
import { Close, ICON_SIZE } from "../ui/icons";
import { t } from "../copy";
import { dismissToast, toasts, type Toast } from "./toast";

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
        <button className="toast-action" onClick={() => { item.onAction?.(); dismissToast(item.id); }}>
          {item.actionLabel}{undoable && left > 0 && <span className="toast-left t-data">{left}s</span>}
        </button>
      )}
      {/* No dismiss on an undoable toast: dismissing it would have to either
          commit or cancel, and a "×" reads as cancel while committing. */}
      {!undoable && (
        <button className="toast-x" aria-label={t("shell.toast.dismiss")} onClick={() => dismissToast(item.id)}>
          <Close size={ICON_SIZE.xl} stroke={1.75} aria-hidden />
        </button>
      )}
    </div>
  );
}

export function Toaster() {
  const list = useStore(toasts);
  return (
    <div className="toaster" role="status" aria-live="polite">
      {list.map((t) => <ToastRow key={t.id} t={t} />)}
    </div>
  );
}
