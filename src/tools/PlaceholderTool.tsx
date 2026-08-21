import { route } from "../shell/router";

/** Empty state per DESIGN.md §4: say what the view is and the next action. */
export function PlaceholderTool(_props: { rest: string[] }) {
  const tool = route.value.tool;
  const copy: Record<string, string> = {
    presets: "Preset browser and editor — builds against /api/chat-presets. Not built yet; the lorebook tool migrates first.",
    memory: "Long-term-memory agent console — builds against the long-term-memory capability package. Not built yet.",
  };
  return (
    <div class="screen">
      <div class="empty">
        <p class="t-label" style="margin-bottom: 8px">{tool}</p>
        <p>{copy[tool] ?? "Unknown tool."}</p>
      </div>
    </div>
  );
}
