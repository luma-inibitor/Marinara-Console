import { useMemo, useRef, type RefObject } from "react";

/** Accepts a synthetic onKeyDown event or a native window event. */
type KeyLike = Pick<KeyboardEvent, "key" | "metaKey" | "ctrlKey" | "altKey" | "target">;

interface RovingOpts {
  listRef: RefObject<HTMLElement | null>;
  keys: string[];
  current: string | null;
  onFocus: (key: string) => void;
  rowSelector?: string;
  navKeys?: string[];
}

export function useRovingFocus(input: RovingOpts) {
  // A stable identity lets a list leave these out of memoized deps safely.
  const latest = useRef(input);
  latest.current = input;

  return useMemo(() => rovingFocus(latest), []);
}

/** Exported for tests that run without React. */
export function rovingFocus(latest: { readonly current: RovingOpts }) {
  const ignore = (ev: KeyLike): boolean => {
    const opts = latest.current;
    // A modified key is an app shortcut.
    if (ev.metaKey || ev.ctrlKey || ev.altKey) return true;

    const el = ev.target as HTMLElement | null;
    if (!el) return false;
    if (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT") return true;
    if (el.isContentEditable) return true;

    // A button outside the rows owns its own Space and Enter.
    if (opts.rowSelector && opts.navKeys) {
      const button = el.closest("button");
      if (button && !button.closest(opts.rowSelector) && !opts.navKeys.includes(ev.key)) return true;
    }
    return false;
  };

  /** Deferring unconditionally put focus a frame behind every keypress. */
  const reveal = (key: string) => {
    const opts = latest.current;
    opts.onFocus(key);
    const land = () => {
      const el = opts.listRef.current?.querySelector(`[data-row="${CSS.escape(key)}"]`) as HTMLElement | null;
      if (!el) return false;
      el.scrollIntoView({ block: "nearest" });
      el.focus?.({ preventScroll: true });
      return true;
    };
    if (!land()) requestAnimationFrame(land);
  };

  /** Wrapping past an end reads as a jump to somewhere else. */
  const move = (delta: number) => {
    const opts = latest.current;
    if (!opts.keys.length) return;
    const i = opts.current ? opts.keys.indexOf(opts.current) : -1;
    const next =
      i === -1 ? (delta > 0 ? 0 : opts.keys.length - 1) : Math.max(0, Math.min(opts.keys.length - 1, i + delta));
    reveal(opts.keys[next]!);
  };

  /** A list with no cursor stays reachable by Tab through its first row. */
  const tabbable = (key: string): boolean => {
    const opts = latest.current;
    return key === (opts.current ?? opts.keys[0] ?? null);
  };

  return { ignore, move, reveal, tabbable };
}
