// Overlay stack: one place that owns Escape, hardware/browser back, and focus
// restore for every layered surface (sheets, the note peek, stacked detail
// screens). Each open pushes a history entry, so the Android back gesture
// closes the topmost overlay instead of leaving the console, and Escape works
// no matter where focus sits (DESIGN §3).
//
// Contract: open an overlay by flipping its signal AND calling
// `openOverlay(close)`; close it ONLY via `closeTopOverlay()` (or the user's
// back button/Escape) — the popstate handler runs the closer, so state and
// history never desync.
//
// `<Sheet>` (src/ui/Sheet.tsx) does both halves of that contract itself, so a
// sheet's opener only flips its signal. This lives in the shell rather than
// beside the memory tool because it is app-wide: it owns the global Escape
// handler and the history stack, and src/ui must be able to reach it without
// importing out of a tool.

interface Entry {
  close: () => void;
  restoreFocus: HTMLElement | null;
}

const stack: Entry[] = [];
let installed = false;

/** Rewinds this module asked for, which have not reached `popstate` yet.
 *
 *  A disposer that unregisters an entry also rewinds the history entry it
 *  pushed, and that rewind arrives as a `popstate` a tick later — by which
 *  time the entry is already gone from the stack. Left unmarked, `settle()`
 *  reads that event as a user pressing back and closes whatever is on top. */
let pendingRewind = 0;

/** A disposer's deferred rewind, still cancellable.
 *
 *  StrictMode tears an effect down and sets it back up inside one tick, so a
 *  disposer that rewound immediately would destroy the history entry the
 *  remount is about to want back — and, because the rewind lands asynchronously
 *  while the remount has already pushed a replacement, the two go out of step
 *  and every later back overshoots the route. Deferring the rewind by a tick
 *  lets the remount ADOPT the standing entry instead, so one overlay owns
 *  exactly one history entry no matter how many times React mounts it. */
let deferredRewind: ReturnType<typeof setTimeout> | null = null;

function settle() {
  // Our own rewind coming back to us: the entry it belonged to was already
  // removed by the disposer, so there is nothing left to close.
  if (pendingRewind > 0) {
    pendingRewind -= 1;
    return;
  }
  // A real back: the stack is the record of what we pushed, so one traversal
  // closes exactly one overlay. Reading a depth out of history.state cannot be
  // trusted — a push that races an in-flight rewind leaves the state behind.
  const entry = stack.pop();
  if (!entry) return; // not ours: an ordinary route navigation
  entry.close();
  if (entry.restoreFocus?.isConnected) entry.restoreFocus.focus();
}

function install() {
  if (installed) return;
  installed = true;
  window.addEventListener("popstate", settle);
  // Tab/tool navigation replaces the view; orphaned overlay entries become
  // inert (settle() finds stack already empty).
  window.addEventListener("hashchange", () => {
    while (stack.length) stack.pop()!.close();
  });
  document.addEventListener(
    "keydown",
    (ev) => {
      if (ev.key !== "Escape" || !stack.length) return;
      ev.preventDefault();
      ev.stopPropagation();
      history.back();
    },
    true,
  );
}

/** Returns a disposer that unregisters the entry without running its closer —
 *  for a component that unmounts without being dismissed. Safe to call twice,
 *  and a no-op once the entry has already been settled by back or Escape.
 *
 *  The disposer removes the entry BEFORE rewinding history, which is what keeps
 *  the resulting popstate harmless: `settle()` sees the entry is already gone.
 *  The rewind itself waits a tick, so a remount in the same tick can adopt the
 *  standing history entry rather than push a second one nothing owns. */
export function openOverlay(close: () => void): () => void {
  install();
  const entry: Entry = { close, restoreFocus: document.activeElement as HTMLElement | null };

  if (deferredRewind !== null) {
    // A disposer ran a moment ago and its entry is still standing: this is the
    // same overlay coming back, so take the entry over instead of pushing.
    clearTimeout(deferredRewind);
    deferredRewind = null;
  } else {
    history.pushState({ mcOverlay: stack.length + 1 }, "", location.href);
  }
  stack.push(entry);

  return () => {
    const i = stack.indexOf(entry);
    if (i === -1) return;
    stack.splice(i, 1);
    if (deferredRewind !== null) return; // already rewinding for this entry
    deferredRewind = setTimeout(() => {
      deferredRewind = null;
      pendingRewind += 1;
      history.back();
    }, 0);
  };
}

/** Programmatic close (× button, scrim tap, post-action) — routes through
 *  history so back/Escape bookkeeping stays consistent. */
export function closeTopOverlay() {
  if (stack.length) history.back();
}
