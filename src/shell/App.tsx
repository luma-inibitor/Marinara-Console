import type { ComponentType } from "preact";
import { useEffect } from "preact/hooks";
import { route, navigate } from "./router";
import { LorebooksTool } from "../tools/lorebooks/LorebooksTool";
import { PlaceholderTool } from "../tools/PlaceholderTool";
import { Toaster } from "./toast";
import { Palette, paletteOpen } from "./palette";

interface ToolDef {
  id: string;
  label: string;
  glyph: string; // single character; icon set comes later
  component: ComponentType<{ rest: string[] }>;
}

const TOOLS: ToolDef[] = [
  { id: "lorebooks", label: "Lorebooks", glyph: "◫", component: LorebooksTool },
  { id: "presets", label: "Presets", glyph: "⌘", component: PlaceholderTool },
  { id: "memory", label: "Memory", glyph: "◉", component: PlaceholderTool },
];

export function App() {
  useEffect(() => {
    const onKey = (ev: KeyboardEvent) => {
      if ((ev.metaKey || ev.ctrlKey) && ev.key.toLowerCase() === "k") {
        ev.preventDefault();
        paletteOpen.value = !paletteOpen.value;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

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
      <Palette />
      <Toaster />
    </div>
  );
}
