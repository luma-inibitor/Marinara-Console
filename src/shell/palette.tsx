// Command palette (Cmd/Ctrl-K) — DESIGN.md §5. Fuzzy over tools, books,
// entries, and actions; searches a local cache, refreshed on open.
import { signal } from "@preact/signals";
import { useEffect, useRef, useState } from "preact/hooks";
import { navigate } from "./router";
import { api } from "./api";
import { t } from "../copy";

export const paletteOpen = signal(false);

function toggleDensity() {
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

// Group names double as the result-list headers, so they are copy, not ids.
const GROUP = {
  navigate: t("shell.palette.groupNavigate"),
  actions: t("shell.palette.groupActions"),
  lorebooks: t("shell.tool.lorebooks"),
  presets: t("shell.tool.presets"),
  entries: t("shell.palette.groupEntries"),
};

const BASE: Item[] = [
  { id: "nav-lorebooks", label: t("shell.palette.goLorebooks"), group: GROUP.navigate, run: () => navigate("lorebooks") },
  { id: "nav-presets", label: t("shell.palette.goPresets"), group: GROUP.navigate, run: () => navigate("presets") },
  { id: "nav-memory", label: t("shell.palette.goMemory"), group: GROUP.navigate, run: () => navigate("memory") },
  { id: "act-density", label: t("shell.palette.density"), group: GROUP.actions, run: toggleDensity },
];

let cache: Item[] = [];
let cacheAt = 0;

async function loadDataItems(): Promise<Item[]> {
  if (Date.now() - cacheAt < 30_000 && cache.length) return cache;
  try {
    const [books, prompts] = await Promise.all([
      api<Array<{ id: string; name: string }>>("/lorebooks"),
      api<Array<{ id: string; name: string }>>("/prompts").catch(() => []),
    ]);
    const bookItems: Item[] = books.map((b) => ({
      id: `b:${b.id}`, label: b.name, group: GROUP.lorebooks,
      run: () => navigate(`lorebooks/${b.id}`),
    }));
    const entryLists = await Promise.all(books.map(async (b) => {
      try {
        const es = await api<Array<{ id: string; name: string }>>(`/lorebooks/${b.id}/entries`);
        return es.map((e): Item => ({
          id: `e:${e.id}`, label: e.name, hint: b.name, group: GROUP.entries,
          run: () => navigate(`lorebooks/${b.id}/${e.id}`),
        }));
      } catch { return []; }
    }));
    const presetItems: Item[] = prompts.map((p) => ({
      id: `p:${p.id}`, label: p.name, group: GROUP.presets,
      run: () => navigate(`presets/${p.id}`),
    }));
    cache = [...bookItems, ...presetItems, ...entryLists.flat()];
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
    : items.filter((it) => it.group !== GROUP.entries)   // unqueried: don't dump every entry
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
    <div className="palette-backdrop" onClick={() => { paletteOpen.value = false; }}>
      <div className="palette" role="dialog" aria-modal="true" aria-label={t("shell.palette.title")}
        onClick={(ev) => ev.stopPropagation()}>
        <input
          ref={inputRef}
          className="palette-input t-data"
          placeholder={t("shell.palette.placeholder")}
          aria-label={t("shell.palette.searchLabel")}
          value={query}
          onInput={(ev) => { setQuery(ev.currentTarget.value); setActive(0); }}
          onKeyDown={onKey}
        />
        <div className="palette-results" role="listbox">
          {results.length === 0 && <div className="palette-empty meta"><span>{t("shell.palette.empty")}</span></div>}
          {results.map((it, i) => {
            const header = it.group !== lastGroup ? (lastGroup = it.group) : null;
            return (
              <div key={it.id}>
                {header && <div className="palette-group t-label t-label-s">{header}</div>}
                <button
                  className={`palette-item ${i === active ? "is-active" : ""}`}
                  role="option"
                  aria-selected={i === active}
                  onMouseEnter={() => setActive(i)}
                  onClick={() => run(it)}
                >
                  <span className="palette-label">{it.label}</span>
                  {it.hint && <span className="palette-hint t-data">{it.hint}</span>}
                </button>
              </div>
            );
          })}
        </div>
        <div className="palette-foot meta" data-contrast-exempt>
          <span>{t("shell.palette.hintMove")}</span><span>{t("shell.palette.hintOpen")}</span><span>{t("shell.palette.hintClose")}</span>
        </div>
      </div>
    </div>
  );
}
