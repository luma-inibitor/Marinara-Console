import { useMemo, useRef, type RefObject } from "react";

/** Only the fields the guards read, so a list can hand this either a synthetic
 *  event from onKeyDown or a native one from a window listener. */
type KeyLike = Pick<KeyboardEvent, "key" | "metaKey" | "ctrlKey" | "altKey" | "target">;

interface RovingOpts {
  listRef: RefObject<HTMLElement | null>;
  /** The list's items, in the order the cursor walks them. */
  keys: string[];
  current: string | null;
  onFocus: (key: string) => void;
  /** Rows whose inner buttons count as part of the list, not as controls that
   *  own their own keys. Omit if the list has no in-row buttons. */
  rowSelector?: string;
  /** Keys that keep working even when a control outside the list has focus. */
  navKeys?: string[];
}

/** Keyboard navigation for a list: j/k roving focus, and the guards that say
 *  which key events belong to the list at all.
 *
 *  The guards are the reason this is shared. Two lists had written this by
 *  hand and the copies had drifted: the review queue ignored events carrying
 *  a modifier, the lorebook audit did not, so Ctrl-J moved the lorebook cursor
 *  as a side effect of any OS or browser shortcut on those letters. Reproduced
 *  before this hook existed — focus a row, press Ctrl-J, watch it move.
 *
 *  Each list keeps its own key map, because their verbs genuinely differ: the
 *  queue has keep/drop/reset, the audit has open. What is shared is movement
 *  and the decision about whether an event is ours. */
export function useRovingFocus(input: RovingOpts) {
  // The returned object and every function on it keep one identity for the
  // hook's lifetime, so a list can put them in a memoized handler's deps —
  // or leave them out — without pinning a stale copy. Freshness comes from
  // this ref instead of from re-creating the closures: each function reads
  // `latest.current` at call time, so it always sees this render's keys,
  // cursor and callback.
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
