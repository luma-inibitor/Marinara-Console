import { useState } from "preact/hooks";
import { Copy, Copied } from "./icons";
import { toast } from "../shell/toast";
import "./CopyableText.css";

/** A value you are meant to be able to take somewhere else — an id, a hash, a
 *  path. Renders as monospace text with a copy control beside it.
 *
 *  Confirmation is inline and brief: the icon becomes a tick for a moment. A
 *  toast for something this small would be louder than the action. The toast
 *  is reserved for the failure, which is the case you actually need to know
 *  about — clipboard writes are refused outside a secure context, and silently
 *  doing nothing would look like a broken button. */
export function CopyableText(props: { value: string; label?: string; className?: string }) {
  const [done, setDone] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(props.value);
      setDone(true);
      setTimeout(() => setDone(false), 1200);
    } catch {
      toast("Could not copy — the clipboard is unavailable here", { kind: "error" });
    }
  };
  return (
    <span className={`copyable ${props.className ?? ""}`}>
      <span className="copyable-v t-data">{props.value}</span>
      <button
        type="button"
        className="copyable-b hit"
        aria-label={done ? "Copied" : `Copy ${props.label ?? props.value}`}
        onClick={copy}
      >
        {done
          ? <Copied size={13} stroke={2} aria-hidden />
          : <Copy size={13} stroke={1.75} aria-hidden />}
      </button>
    </span>
  );
}
