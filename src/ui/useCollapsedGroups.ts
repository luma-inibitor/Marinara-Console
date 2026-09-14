import { readStorage, writeStorage } from "../lib/storage";
import { createStore, useStore } from "../lib/store";

export function collapsedGroups(storageKey?: string) {
  const initial: string[] = storageKey ? safeParse(readStorage(storageKey)) : [];
  const ids = createStore<Set<string>>(new Set(initial));

  function toggle(id: string) {
    const next = new Set(ids.get());
    next.has(id) ? next.delete(id) : next.add(id);
    ids.set(next);
    if (storageKey) writeStorage(storageKey, JSON.stringify([...next]));
  }

  /** A `has(id)` helper would read the store without subscribing. */
  function useCollapsed(): ReadonlySet<string> {
    return useStore(ids);
  }

  return { ids, toggle, useCollapsed };
}

function safeParse(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) ? v.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}
