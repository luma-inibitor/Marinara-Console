import { signal } from "@preact/signals";

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
  const initial: string[] = storageKey
    ? safeParse(localStorage.getItem(storageKey))
    : [];
  const ids = signal<Set<string>>(new Set(initial));

  function toggle(id: string) {
    const next = new Set(ids.value);
    next.has(id) ? next.delete(id) : next.add(id);
    ids.value = next;
    if (storageKey) localStorage.setItem(storageKey, JSON.stringify([...next]));
  }

  /** `ids` is the signal itself, for reading inside a memo's dependency list.
   *  `has` is the convenience read for render. */
  return { ids, toggle, has: (id: string) => ids.value.has(id) };
}

function safeParse(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) ? v.filter((x) => typeof x === "string") : [];
  } catch {
    return [];   // a corrupt key should fold nothing, not throw on first paint
  }
}
