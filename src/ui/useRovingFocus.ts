import type { RefObject } from "preact";

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
export function useRovingFocus(opts: {
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
}) {
  /** True when the event is not the list's to handle. */
  const ignore = (ev: KeyboardEvent): boolean => {
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
   *  hook does not need to know which kind of list it is driving. */
  const reveal = (key: string) => {
    opts.onFocus(key);
    requestAnimationFrame(() => {
      const el = opts.listRef.current?.querySelector(
        `[data-row="${CSS.escape(key)}"]`,
      ) as HTMLElement | null;
      if (!el) return;
      el.scrollIntoView({ block: "nearest" });
      el.focus?.({ preventScroll: true });
    });
  };

  /** Step the cursor. From nowhere, a step down starts at the top and a step
   *  up starts at the bottom; from an end, it stays put rather than wrapping —
   *  wrapping past the last row reads as a jump to somewhere else. */
  const move = (delta: number) => {
    if (!opts.keys.length) return;
    const i = opts.current ? opts.keys.indexOf(opts.current) : -1;
    const next = i === -1
      ? (delta > 0 ? 0 : opts.keys.length - 1)
      : Math.max(0, Math.min(opts.keys.length - 1, i + delta));
    reveal(opts.keys[next]!);
  };

  return { ignore, move, reveal };
}
