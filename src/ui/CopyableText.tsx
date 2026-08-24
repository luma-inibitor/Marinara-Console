import { useState } from "react";
import { Copy, Copied } from "./icons";
import { toast } from "../shell/toast";
import { t } from "../copy";
import "./CopyableText.css";

/** A value you are meant to be able to take somewhere else — an id, a hash, a
 *  path. Renders as monospace text with a copy control beside it.
 *
 *  Success is confirmed inline (the icon becomes a tick); the toast is reserved
 *  for failure. Clipboard writes are refused outside a secure context, and
 *  silently doing nothing there would look like a broken button. */
export function CopyableText(props: { value: string; label?: string; className?: string }) {
  const [done, setDone] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(props.value);
      setDone(true);
      setTimeout(() => setDone(false), 1200);
    } catch {
      toast(t("ui.copy.failed"), { kind: "error" });
    }
  };
  return (
    <span className={`copyable ${props.className ?? ""}`}>
      <span className="copyable-v t-data">{props.value}</span>
      <button
        type="button"
        className="copyable-b hit"
        aria-label={done ? t("ui.copy.copied") : t("ui.copy.value", { what: props.label ?? props.value })}
        onClick={copy}
      >
        {done
          ? <Copied size={13} stroke={2} aria-hidden />
          : <Copy size={13} stroke={1.75} aria-hidden />}
      </button>
    </span>
  );
}
