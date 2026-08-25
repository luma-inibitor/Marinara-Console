import type { ComponentType } from "react";
import { route, navigate } from "./router";
import { useStore } from "../lib/store";
import { LorebooksTool } from "../tools/lorebooks/LorebooksTool";
import { MemoryTool } from "../tools/memory/MemoryTool";
import { PresetsTool } from "../tools/presets/PresetsTool";
import { Toaster } from "./Toaster";
import { Palette } from "./palette";
import { ConnectionBanner, noteResult, startReconnect, reach } from "./connection";
import { setResultHook } from "./api";
import { useHotkeys, CheatSheet } from "./hotkeys";
import { t } from "../copy";

interface ToolDef {
  id: string;
  label: string;
  glyph: string; // single character
  component: ComponentType<{ rest: string[] }>;
}

const TOOLS: ToolDef[] = [
  { id: "lorebooks", label: t("shell.tool.lorebooks"), glyph: "◫", component: LorebooksTool },
  { id: "presets", label: t("shell.tool.presets"), glyph: "⌘", component: PresetsTool },
  { id: "memory", label: t("shell.tool.memory"), glyph: "◉", component: MemoryTool },
];

setResultHook((err) => {
  noteResult(err);
  if (reach.get() !== "ok") startReconnect();
});

export function App() {
  useHotkeys();

  const { tool, rest } = useStore(route);
  const active = TOOLS.find((d) => d.id === tool) ?? TOOLS[0];
  const Screen = active.component;

  return (
    <div className="shell">
      <nav className="rail" aria-label={t("shell.nav.tools")}>
        {/* data-brand: copycheck skips this subtree. */}
        {/* eslint-disable-next-line i18next/no-literal-string -- the product name is not copy and has no catalog entry. */}
        <div className="rail-brand t-label-s t-label" data-brand data-contrast-exempt>Marinara<br />Console</div>
        {TOOLS.map((d) => (
          <button
            key={d.id}
            className={`rail-item ${d.id === active.id ? "is-active" : ""}`}
            aria-current={d.id === active.id ? "page" : undefined}
            onClick={() => navigate(d.id)}
          >
            <span className="rail-glyph" aria-hidden="true">{d.glyph}</span>
            <span className="rail-label">{d.label}</span>
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
