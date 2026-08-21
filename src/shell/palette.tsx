// Command palette (Cmd/Ctrl-K) — DESIGN.md §5. Fuzzy over tools, books,
// entries, and actions; instant (searches a local cache, refreshed on open).
// Shows hints so shortcuts get learned in passing.
import { signal } from "@preact/signals";
import { useEffect, useRef, useState } from "preact/hooks";
import { navigate } from "./router";
import { api } from "./api";

export const paletteOpen = signal(false);

export function toggleDensity() {
  const el = document.documentElement;
  const next = el.dataset.density === "compact" ? "comfortable" : "compact";
  el.dataset.density = next;
  localStorage.setItem("mc-density", next);
}

interface Item {
  id: string;
  label: string;
  hint?: string;   // right-aligned context (book name, shortcut)
  group: string;
  run: () => void;
}

const BASE: Item[] = [
  { id: "nav-lorebooks", label: "Go to Lorebooks", group: "Navigate", run: () => navigate("lorebooks") },
  { id: "nav-presets", label: "Go to Presets", group: "Navigate", run: () => navigate("presets") },
  { id: "nav-memory", label: "Go to Memory", group: "Navigate", run: () => navigate("memory") },
  { id: "act-density", label: "Toggle density (comfortable / compact)", group: "Actions", run: toggleDensity },
];

let cache: Item[] = [];
let cacheAt = 0;

async function loadDataItems(): Promise<Item[]> {
  if (Date.now() - cacheAt < 30_000 && cache.length) return cache;
  try {
    const books = await api<Array<{ id: string; name: string }>>("/lorebooks");
    const bookItems: Item[] = books.map((b) => ({
      id: `b:${b.id}`, label: b.name, group: "Lorebooks",
      run: () => navigate(`lorebooks/${b.id}`),
    }));
    const entryLists = await Promise.all(books.map(async (b) => {
      try {
        const es = await api<Array<{ id: string; name: string }>>(`/lorebooks/${b.id}/entries`);
        return es.map((e): Item => ({
          id: `e:${e.id}`, label: e.name, hint: b.name, group: "Entries",
          run: () => navigate(`lorebooks/${b.id}/${e.id}`),
        }));
      } catch { return []; }
    }));
    cache = [...bookItems, ...entryLists.flat()];
    cacheAt = Date.now();
  } catch { /* engine unreachable — navigation items still work */ }
  return cache;
}

/** 0 = prefix, 1 = substring, 2 = subsequence, -1 = miss. */
function score(label: string, q: string): number {
  const l = label.toLowerCase();
  if (l.startsWith(q)) return 0;
  if (l.includes(q)) return 1;
  let i = 0;
  for (const ch of l) { if (ch === q[i]) i++; if (i === q.length) return 2; }
  return -1;
}

export function Palette() {
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<Item[]>(BASE);
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const open = paletteOpen.value;

  useEffect(() => {
    if (!open) return;
    setQuery("");
    setActive(0);
    inputRef.current?.focus();
    void loadDataItems().then((data) => setItems([...BASE, ...data]));
  }, [open]);

  if (!open) return null;

  const q = query.trim().toLowerCase();
  const results = (q
    ? items.map((it) => ({ it, s: score(it.label, q) })).filter((x) => x.s >= 0)
        .sort((a, b) => a.s - b.s || a.it.label.length - b.it.label.length).map((x) => x.it)
    : items.filter((it) => it.group !== "Entries")   // unqueried: don't dump every entry
  ).slice(0, 12);

  const run = (it: Item) => { paletteOpen.value = false; it.run(); };

  const onKey = (ev: KeyboardEvent) => {
    if (ev.key === "ArrowDown") { ev.preventDefault(); setActive((a) => Math.min(results.length - 1, a + 1)); }
    else if (ev.key === "ArrowUp") { ev.preventDefault(); setActive((a) => Math.max(0, a - 1)); }
    else if (ev.key === "Enter" && results[active]) { ev.preventDefault(); run(results[active]); }
    else if (ev.key === "Escape") { ev.preventDefault(); paletteOpen.value = false; }
  };

  let lastGroup = "";
  return (
    <div class="palette-backdrop" onClick={() => { paletteOpen.value = false; }}>
      <div class="palette" role="dialog" aria-modal="true" aria-label="Command palette"
        onClick={(ev) => ev.stopPropagation()}>
        <input
          ref={inputRef}
          class="palette-input t-data"
          placeholder="Search tools, books, entries…"
          aria-label="Search commands"
          value={query}
          onInput={(ev) => { setQuery(ev.currentTarget.value); setActive(0); }}
          onKeyDown={onKey}
        />
        <div class="palette-results" role="listbox">
          {results.length === 0 && <div class="palette-empty meta"><span>No matches</span></div>}
          {results.map((it, i) => {
            const header = it.group !== lastGroup ? (lastGroup = it.group) : null;
            return (
              <div key={it.id}>
                {header && <div class="palette-group t-label t-label-s">{header}</div>}
                <button
                  class={`palette-item ${i === active ? "is-active" : ""}`}
                  role="option"
                  aria-selected={i === active}
                  onMouseEnter={() => setActive(i)}
                  onClick={() => run(it)}
                >
                  <span class="palette-label">{it.label}</span>
                  {it.hint && <span class="palette-hint t-data">{it.hint}</span>}
                </button>
              </div>
            );
          })}
        </div>
        <div class="palette-foot meta" data-contrast-exempt>
          <span>↑↓ move</span><span>↵ open</span><span>esc close</span>
        </div>
      </div>
    </div>
  );
}
