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

interface Entry { close: () => void; restoreFocus: HTMLElement | null }

const stack: Entry[] = [];
let installed = false;

function depth(): number {
  return (history.state && typeof history.state.mcOverlay === "number") ? history.state.mcOverlay : 0;
}

function settle() {
  // Close every overlay deeper than the current history state says exists.
  const want = depth();
  while (stack.length > want) {
    const entry = stack.pop()!;
    entry.close();
    if (entry.restoreFocus?.isConnected) entry.restoreFocus.focus();
  }
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
  document.addEventListener("keydown", (ev) => {
    if (ev.key !== "Escape" || !stack.length) return;
    ev.preventDefault();
    ev.stopPropagation();
    history.back();
  }, true);
}

/** Returns a disposer that unregisters the entry without running its closer —
 *  for a component that unmounts without being dismissed. Safe to call twice,
 *  and a no-op once the entry has already been settled by back or Escape.
 *
 *  The disposer removes the entry BEFORE rewinding history, which is what keeps
 *  the resulting popstate harmless: settle() then finds the stack already at
 *  the depth the restored state asks for. It rewinds only when our own entry is
 *  still the current one — if something else navigated in between, an extra
 *  history entry is the cheaper mistake than eating someone else's. */
export function openOverlay(close: () => void): () => void {
  install();
  const entry: Entry = { close, restoreFocus: document.activeElement as HTMLElement | null };
  stack.push(entry);
  const mine = stack.length;
  history.pushState({ mcOverlay: mine }, "", location.href);

  return () => {
    const i = stack.indexOf(entry);
    if (i === -1) return;
    stack.splice(i, 1);
    if (depth() === mine) history.back();
  };
}

/** Programmatic close (× button, scrim tap, post-action) — routes through
 *  history so back/Escape bookkeeping stays consistent. */
export function closeTopOverlay() {
  if (stack.length) history.back();
}
