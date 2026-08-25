// Hash router: #/tool/rest... — deep links with no server routes.
import { createStore } from "../lib/store";

interface Route {
  tool: string;
  rest: string[];
}

function parse(): Route {
  const parts = location.hash.replace(/^#\/?/, "").split("/").filter(Boolean);
  return { tool: parts[0] ?? "lorebooks", rest: parts.slice(1) };
}

export const route = createStore<Route>(parse());

window.addEventListener("hashchange", () => {
  route.set(parse());
});

export function navigate(path: string) {
  location.hash = path.startsWith("#") ? path : `#/${path.replace(/^\/+/, "")}`;
}
