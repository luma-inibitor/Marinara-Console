// Global keyboard layer (DESIGN.md §3): Cmd/Ctrl-K palette, `g` navigation
// sequences, `?` cheat sheet. Single-key bindings are suppressed while typing.
import { signal } from "@preact/signals";
import { useEffect } from "preact/hooks";
import { navigate } from "./router";
import { paletteOpen } from "./palette";

export const cheatOpen = signal(false);

const G_TARGETS: Record<string, string> = { l: "lorebooks", p: "presets", m: "memory" };
let gArmed = false;
let gTimer: ReturnType<typeof setTimeout> | undefined;

const isTyping = (t: EventTarget | null) =>
  t instanceof HTMLElement &&
  (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable);

export function useHotkeys() {
  useEffect(() => {
    const onKey = (ev: KeyboardEvent) => {
      // Cmd/Ctrl-K works everywhere, including inputs
      if ((ev.metaKey || ev.ctrlKey) && ev.key.toLowerCase() === "k") {
        ev.preventDefault();
        paletteOpen.value = !paletteOpen.value;
        return;
      }
      if (isTyping(ev.target) || ev.metaKey || ev.ctrlKey || ev.altKey) return;

      if (gArmed) {
        gArmed = false;
        clearTimeout(gTimer);
        const target = G_TARGETS[ev.key.toLowerCase()];
        if (target) { ev.preventDefault(); navigate(target); }
        return;
      }
      if (ev.key === "g") {
        gArmed = true;
        clearTimeout(gTimer);
        gTimer = setTimeout(() => { gArmed = false; }, 1200);
        return;
      }
      if (ev.key === "?") { ev.preventDefault(); cheatOpen.value = !cheatOpen.value; return; }
      if (ev.key === "Escape" && cheatOpen.value) { cheatOpen.value = false; }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
}

const SHORTCUTS: Array<[string, string]> = [
  ["⌘K / Ctrl-K", "Command palette — tools, books, entries, actions"],
  ["g then l / p / m", "Go to Lorebooks / Presets / Memory"],
  ["j / k or ↓ / ↑", "Move focus in a list"],
  ["Enter or o", "Open the focused row"],
  ["Escape", "Close / back"],
  ["?", "This cheat sheet"],
];

export function CheatSheet() {
  if (!cheatOpen.value) return null;
  return (
    <div class="palette-backdrop" onClick={() => { cheatOpen.value = false; }}>
      <div class="palette cheat" role="dialog" aria-modal="true" aria-label="Keyboard shortcuts"
        onClick={(ev) => ev.stopPropagation()}>
        <div class="cheat-head t-label">Keyboard shortcuts</div>
        <div class="cheat-body">
          {SHORTCUTS.map(([keys, what]) => (
            <div key={keys} class="cheat-row">
              <span class="cheat-keys t-data">{keys}</span>
              <span class="cheat-what">{what}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
