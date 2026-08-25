// Global keyboard layer (DESIGN.md §3): Cmd/Ctrl-K palette, `g` navigation
// sequences, `?` cheat sheet. Single-key bindings are suppressed while typing.
import { useEffect } from "react";
import { createStore, useStore } from "../lib/store";
import { navigate } from "./router";
import { paletteOpen } from "./palette";
import { t } from "../copy";

const cheatOpen = createStore(false);

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
        paletteOpen.update((v) => !v);
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
      if (ev.key === "?") { ev.preventDefault(); cheatOpen.update((v) => !v); return; }
      if (ev.key === "Escape" && cheatOpen.get()) { cheatOpen.set(false); }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      // The `g` sequence is module state: a pending timer outliving this
      // listener would disarm a sequence armed by the next one.
      clearTimeout(gTimer);
      gTimer = undefined;
      gArmed = false;
    };
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
  const open = useStore(cheatOpen);
  if (!open) return null;
  return (
    <div className="palette-backdrop" onClick={() => { cheatOpen.set(false); }}>
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
