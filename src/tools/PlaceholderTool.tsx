import { route } from "../shell/router";
import { useStore } from "../lib/store";
import { EmptyState } from "../ui";

/** Empty state per DESIGN.md §4: say what the view is and the next action. */
export function PlaceholderTool(_props: { rest: string[] }) {
  const tool = useStore(route).tool;
  const copy: Record<string, string> = {
    presets: "Preset browser and editor — builds against /api/chat-presets. Not built yet; the lorebook tool migrates first.",
    memory: "Long-term-memory agent console — builds against the long-term-memory capability package. Not built yet.",
  };
  return (
    <div className="screen">
      <EmptyState title={tool} body={copy[tool] ?? "Unknown tool."} />
    </div>
  );
}
