import type { ComponentType } from "preact";
import { route, navigate } from "./router";
import { LorebooksTool } from "../tools/lorebooks/LorebooksTool";
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
  { id: "memory", label: "Memory", glyph: "◉", component: PlaceholderTool },
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
    <div class="shell">
      <nav class="rail" aria-label="Tools">
        <div class="rail-brand t-label-s t-label" data-contrast-exempt>Marinara<br />Console</div>
        {TOOLS.map((t) => (
          <button
            key={t.id}
            class={`rail-item ${t.id === active.id ? "is-active" : ""}`}
            aria-current={t.id === active.id ? "page" : undefined}
            onClick={() => navigate(t.id)}
          >
            <span class="rail-glyph" aria-hidden="true">{t.glyph}</span>
            <span class="rail-label">{t.label}</span>
          </button>
        ))}
      </nav>
      <main class="stage">
        <Screen rest={rest} />
      </main>
      <ConnectionBanner />
      <Palette />
      <CheatSheet />
      <Toaster />
    </div>
  );
}
