import type { ComponentType } from "preact";
import { route, navigate } from "./router";
import { LorebooksTool } from "../tools/lorebooks/LorebooksTool";
import { MemoryTool } from "../tools/memory/MemoryTool";
import { PlaceholderTool } from "../tools/PlaceholderTool";
import { PresetsTool } from "../tools/presets/PresetsTool";
import { Toaster } from "./toast";
import { Palette } from "./palette";
import { ConnectionBanner, noteResult, startReconnect, reach } from "./connection";
import { setResultHook } from "./api";
import { useHotkeys, CheatSheet } from "./hotkeys";

interface ToolDef {
  id: string;
  label: string;
  glyph: string; // single character; icon set comes later
  component: ComponentType<{ rest: string[] }>;
}

const TOOLS: ToolDef[] = [
  { id: "lorebooks", label: "Lorebooks", glyph: "◫", component: LorebooksTool },
  { id: "presets", label: "Presets", glyph: "⌘", component: PresetsTool },
  { id: "memory", label: "Memory", glyph: "◉", component: MemoryTool },
];

setResultHook((err) => {
  noteResult(err);
  if (reach.value !== "ok") startReconnect();
});

export function App() {
  useHotkeys();

  const { tool, rest } = route.value;
  const active = TOOLS.find((t) => t.id === tool) ?? TOOLS[0];
  const Screen = active.component;

  return (
    <div className="shell">
      <nav className="rail" aria-label="Tools">
        <div className="rail-brand t-label-s t-label" data-contrast-exempt>Marinara<br />Console</div>
        {TOOLS.map((t) => (
          <button
            key={t.id}
            className={`rail-item ${t.id === active.id ? "is-active" : ""}`}
            aria-current={t.id === active.id ? "page" : undefined}
            onClick={() => navigate(t.id)}
          >
            <span className="rail-glyph" aria-hidden="true">{t.glyph}</span>
            <span className="rail-label">{t.label}</span>
          </button>
        ))}
      </nav>
      <main className="stage">
        <Screen rest={rest} />
      </main>
      <ConnectionBanner />
      <Palette />
      <CheatSheet />
      <Toaster />
    </div>
  );
}
