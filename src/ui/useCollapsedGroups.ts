import { createStore, useStore } from "../lib/store";

/** Collapsed-group state for a grouped list.
 *
 *  Two lists needed this and had grown two copies that disagreed: the review
 *  queue forgot collapsed groups on every visit, the sources list remembered
 *  them. Persistence is now a parameter rather than a fork, so the difference
 *  is a decision someone made instead of an accident.
 *
 *  Pass a storage key to remember across sessions. Omit it for view state that
 *  should reset — a queue you are working through is not the same as a
 *  ninety-row inventory you keep folded. */
export function collapsedGroups(storageKey?: string) {
  const initial: string[] = storageKey ? safeParse(localStorage.getItem(storageKey)) : [];
  const ids = createStore<Set<string>>(new Set(initial));

  function toggle(id: string) {
    const next = new Set(ids.get());
    next.has(id) ? next.delete(id) : next.add(id);
    ids.set(next);
    if (storageKey) localStorage.setItem(storageKey, JSON.stringify([...next]));
  }

  /** The subscribing read, and the only legal one during render. There is
   *  deliberately no `has(id)` helper: it would close over the store and read
   *  it without subscribing, which under React returns the right answer and
   *  silently stops re-rendering. Call `useCollapsed()` and ask the Set.
   *
   *  `toggle` assigns a fresh Set every time, so the identity change is what
   *  invalidates a useMemo depending on it. Do not mutate in place. */
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
    return []; // a corrupt key should fold nothing, not throw on first paint
  }
}
