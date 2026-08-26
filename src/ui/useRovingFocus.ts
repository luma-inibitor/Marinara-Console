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

  return useMemo(() => {
    /** True when the event is not the list's to handle. */
    const ignore = (ev: KeyLike): boolean => {
      const opts = latest.current;
      // A shortcut is a shortcut. Cmd-K opens the palette; it must not also
      // walk the cursor.
      if (ev.metaKey || ev.ctrlKey || ev.altKey) return true;

      const el = ev.target as HTMLElement | null;
      if (!el) return false;
      // Someone typing has the keyboard, whatever the letter means to the list.
      if (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT") return true;
      if (el.isContentEditable) return true;

      // A focused button outside the rows (a chip, a header control) owns its
      // own Space and Enter. Buttons inside a row are part of the list
      // composite, so the triage keys keep working after tapping a row.
      if (opts.rowSelector && opts.navKeys) {
        const button = el.closest("button");
        if (button && !button.closest(opts.rowSelector) && !opts.navKeys.includes(ev.key)) return true;
      }
      return false;
    };

    /** Put the cursor on a key, bring it into view, and hand it DOM focus when
     *  the row can take it.
     *
     *  Both matter, and which one does the work depends on the list. The
     *  lorebook audit's rows are buttons, so focus moves and the browser scrolls
     *  for us; the review queue's rows are divs, so focus() is a no-op and the
     *  explicit scroll is what keeps the cursor on screen. Doing both means the
     *  hook does not need to know which kind of list it is driving.
     *
     *  Synchronous when the row is already in the DOM, deferred only when it is
     *  not. The deferral exists because the row may not be rendered until the
     *  state change this call just made has flushed. Deferring unconditionally
     *  put focus a frame behind every keypress, which made the keyboard walk
     *  fail intermittently — and an intermittent check is one people learn to
     *  ignore. */
    const reveal = (key: string) => {
      const opts = latest.current;
      opts.onFocus(key);
      const land = () => {
        const el = opts.listRef.current?.querySelector(
          `[data-row="${CSS.escape(key)}"]`,
        ) as HTMLElement | null;
        if (!el) return false;
        el.scrollIntoView({ block: "nearest" });
        el.focus?.({ preventScroll: true });
        return true;
      };
      if (!land()) requestAnimationFrame(land);
    };

    /** Step the cursor. From nowhere, a step down starts at the top and a step
     *  up starts at the bottom; from an end, it stays put rather than wrapping —
     *  wrapping past the last row reads as a jump to somewhere else. */
    const move = (delta: number) => {
      const opts = latest.current;
      if (!opts.keys.length) return;
      const i = opts.current ? opts.keys.indexOf(opts.current) : -1;
      const next = i === -1
        ? (delta > 0 ? 0 : opts.keys.length - 1)
        : Math.max(0, Math.min(opts.keys.length - 1, i + delta));
      reveal(opts.keys[next]!);
    };

    /** Roving tabindex: exactly one item in the composite is in the tab order.
     *
     *  Without this a list is as many tab stops as it has controls — the review
     *  queue measured 279, three per row across 42 rows, so reaching the apply
     *  dock by keyboard cost 279 presses. The composite pattern is one stop to
     *  enter, arrows to move within, one stop to leave.
     *
     *  The cursor row holds the stop; with no cursor it falls to the first row,
     *  so the list is always enterable. Never nothing — a composite with no
     *  tabbable item is a composite you cannot reach at all. */
    const tabbable = (key: string): boolean => {
      const opts = latest.current;
      return key === (opts.current ?? opts.keys[0] ?? null);
    };

    return { ignore, move, reveal, tabbable };
  }, []);
}
