// Hash router: #/tool/rest... — deep links with no server routes.
import { signal } from "@preact/signals";

export interface Route {
  tool: string;
  rest: string[];
}

function parse(): Route {
  const parts = location.hash.replace(/^#\/?/, "").split("/").filter(Boolean);
  return { tool: parts[0] ?? "lorebooks", rest: parts.slice(1) };
}

export const route = signal<Route>(parse());

window.addEventListener("hashchange", () => {
  route.value = parse();
});

export function navigate(path: string) {
  location.hash = path.startsWith("#") ? path : `#/${path.replace(/^\/+/, "")}`;
}
