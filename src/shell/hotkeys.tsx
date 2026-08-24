// Global keyboard layer (DESIGN.md §3): Cmd/Ctrl-K palette, `g` navigation
// sequences, `?` cheat sheet. Single-key bindings are suppressed while typing.
import { signal } from "@preact/signals";
import { useEffect } from "preact/hooks";
import { navigate } from "./router";
import { paletteOpen } from "./palette";
import { t } from "../copy";

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

// The left column is key notation, not copy: "⌘K", "Escape", "j / k" name
// physical keys, so they stay literal. Only the right column is routed.
const SHORTCUTS: Array<[string, string]> = [
  ["⌘K / Ctrl-K", t("shell.hotkeys.palette")],
  ["g then l / p / m", t("shell.hotkeys.go")],
  ["j / k or ↓ / ↑", t("shell.hotkeys.move")],
  ["Enter or o", t("shell.hotkeys.open")],
  ["Escape", t("shell.hotkeys.close")],
  ["?", t("shell.hotkeys.cheat")],
];

export function CheatSheet() {
  if (!cheatOpen.value) return null;
  return (
    <div className="palette-backdrop" onClick={() => { cheatOpen.value = false; }}>
      <div className="palette cheat" role="dialog" aria-modal="true" aria-label={t("shell.hotkeys.title")}
        onClick={(ev) => ev.stopPropagation()}>
        <div className="cheat-head t-label">{t("shell.hotkeys.title")}</div>
        <div className="cheat-body">
          {SHORTCUTS.map(([keys, what]) => (
            <div key={keys} className="cheat-row">
              <span className="cheat-keys t-data">{keys}</span>
              <span className="cheat-what">{what}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
