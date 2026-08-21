// The audit screen: console header (Find/Test probe, budget meter, sort chips),
// audit rows, bulk select, tag panel, and the entry editor — inline accordion on
// mobile, master-detail side panel on desktop (DESIGN.md §6).
import type { ComponentChildren } from "preact";
import { useCallback, useEffect, useMemo, useRef, useState } from "preact/hooks";
import { navigate } from "../../shell/router";
import { toast } from "../../shell/toast";
import {
  type Entry, type Lorebook, type Evaluation,
  entryTokens, statusOf, percentile, evaluate, matchesQuery, tagStats,
  fetchBooks, fetchEntries, patchEntry, createEntry, deleteEntry, bulkPatch,
  POS_COMPACT,
} from "./data";
import { EntryDrawer, type FullscreenCtx } from "./entries";
import { FullscreenText } from "../../ui/FullscreenText";

type SortKey = "tokens" | "order" | "keys" | "name" | "updated";
type Mode = "find" | "test";
export type SavePill = "dirty" | "saved" | "err";

const UNTAGGED = " untagged";

function useIsDesktop(): boolean {
  const [is, setIs] = useState(() => window.matchMedia("(min-width: 900px)").matches);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 900px)");
    const fn = () => setIs(mq.matches);
    mq.addEventListener("change", fn);
    return () => mq.removeEventListener("change", fn);
  }, []);
  return is;
}

export function BookAudit({ bookId, initialEntryId }: { bookId: string; initialEntryId?: string }) {
  const desktop = useIsDesktop();
  const [book, setBook] = useState<Lorebook | null>(null);
  const [entries, setEntries] = useState<Entry[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [mode, setMode] = useState<Mode>("find");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortKey>("tokens");
  const [group, setGroup] = useState(false);
  const [flaggedOnly, setFlaggedOnly] = useState(false);
  const [open, setOpen] = useState<Set<string>>(new Set());       // mobile inline drawers (multi-expand)
  const [focusId, setFocusId] = useState<string | null>(null);    // desktop detail target + keyboard focus
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pills, setPills] = useState<Record<string, SavePill>>({});
  const [showTags, setShowTags] = useState(false);
  const [full, setFull] = useState<FullscreenCtx | null>(null);

  const listRef = useRef<HTMLDivElement>(null);
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  // deep link from the palette: focus + reveal a specific entry once loaded
  useEffect(() => {
    if (!entries || !initialEntryId) return;
    if (!entries.some((e) => e.id === initialEntryId)) return;
    setFocusId(initialEntryId);
    setOpen((s) => new Set(s).add(initialEntryId));
    requestAnimationFrame(() => {
      (listRef.current?.querySelector(`[data-row="${CSS.escape(initialEntryId)}"]`) as HTMLElement | null)
        ?.scrollIntoView({ block: "center" });
    });
  }, [entries, initialEntryId]);

  useEffect(() => {
    fetchBooks().then((bs) => setBook(bs.find((b) => b.id === bookId) ?? null)).catch((e: Error) => setError(e.message));
    fetchEntries(bookId).then(setEntries).catch((e: Error) => setError(e.message));
  }, [bookId]);

  // ── derived ──
  const p90 = useMemo(() => percentile((entries ?? []).map(entryTokens), 0.9), [entries]);
  const kp90 = useMemo(() => percentile((entries ?? []).map((e) => e.keys.length), 0.9), [entries]);
  const isFlagged = useCallback(
    (e: Entry) => entryTokens(e) > p90 || e.keys.length > kp90,
    [p90, kp90],
  );

  const evals = useMemo(() => {
    const m = new Map<string, Evaluation>();
    if (mode === "test") for (const e of entries ?? []) m.set(e.id, evaluate(e, query));
    return m;
  }, [entries, mode, query]);

  const visible = useMemo(() => {
    let list = [...(entries ?? [])];
    if (mode === "find") list = list.filter((e) => matchesQuery(e, query));
    if (flaggedOnly) list = list.filter(isFlagged);
    const cmp: Record<SortKey, (a: Entry, b: Entry) => number> = {
      tokens: (a, b) => entryTokens(b) - entryTokens(a),
      order: (a, b) => a.order - b.order,
      keys: (a, b) => b.keys.length - a.keys.length,
      name: (a, b) => a.name.localeCompare(b.name),
      updated: (a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)),
    };
    list.sort((a, b) => {
      if (mode === "test") {
        const fa = evals.get(a.id)?.fires ? 1 : 0, fb = evals.get(b.id)?.fires ? 1 : 0;
        if (fa !== fb) return fb - fa;
      }
      return cmp[sort](a, b);
    });
    return list;
  }, [entries, mode, query, flaggedOnly, sort, evals, isFlagged]);

  const meter = useMemo(() => {
    const budget = book?.tokenBudget || 1;
    const testing = mode === "test" && query.trim() !== "";
    const pool = testing
      ? (entries ?? []).filter((e) => evals.get(e.id)?.fires)
      : (entries ?? []).filter((e) => e.enabled);
    const aTok = pool.filter((e) => e.constant).reduce((a, e) => a + entryTokens(e), 0);
    const kTok = pool.filter((e) => !e.constant).reduce((a, e) => a + entryTokens(e), 0);
    return { testing, budget, pool, aTok, kTok, total: aTok + kTok, over: aTok + kTok > budget };
  }, [entries, evals, mode, query, book]);

  // ── saving (field-level PATCH; debounce 700ms, flush via immediate) ──
  const setPill = (id: string, v: SavePill) => setPills((p) => ({ ...p, [id]: v }));

  const save = useCallback((id: string, patch: Record<string, unknown>, immediate = false) => {
    setEntries((es) => (es ?? []).map((e) => (e.id === id ? { ...e, ...patch } as Entry : e)));
    setPill(id, "dirty");
    clearTimeout(timers.current.get(id));
    const run = async () => {
      timers.current.delete(id);
      try {
        const updated = await patchEntry(bookId, id, patch);
        if (updated) setEntries((es) => (es ?? []).map((e) => (e.id === id ? { ...e, ...updated } : e)));
        setPill(id, "saved");
      } catch (err) {
        setPill(id, "err");
        toast(`Failed to save entry: ${(err as Error).message}`, { kind: "error" });
      }
    };
    if (immediate) void run();
    else timers.current.set(id, setTimeout(run, 700));
  }, [bookId]);

  // ── delete with undo (soft: DELETE fires when the toast expires) ──
  const removeWithUndo = useCallback((entry: Entry) => {
    setEntries((es) => (es ?? []).filter((e) => e.id !== entry.id));
    setOpen((s) => { const n = new Set(s); n.delete(entry.id); return n; });
    if (focusId === entry.id) setFocusId(null);
    toast(`Deleted "${entry.name}".`, {
      actionLabel: "Undo",
      onAction: () => {
        // restore locally; entry still exists server-side (nothing sent yet)
        setEntries((es) => [...(es ?? []), entry]);
      },
      onExpire: () => {
        deleteEntry(bookId, entry.id).catch((err: Error) => {
          toast(`Delete failed: ${err.message}`, { kind: "error" });
          setEntries((es) => [...(es ?? []), entry]);
        });
      },
    });
  }, [bookId, focusId]);

  const addEntry = useCallback(async () => {
    const name = prompt("Add Entry", "New Entry");
    if (!name?.trim()) return;
    try {
      const created = await createEntry(bookId, { name: name.trim(), content: "", keys: [] });
      setEntries((es) => [...(es ?? []), created]);
      setFocusId(created.id);
      setOpen((s) => new Set(s).add(created.id));
    } catch (err) { toast(`Failed to add entry: ${(err as Error).message}`, { kind: "error" }); }
  }, [bookId]);

  const runBulk = useCallback(async (changes: Record<string, unknown>) => {
    const ids = [...selected];
    if (!ids.length) return toast("Nothing selected", { kind: "error" });
    try {
      await bulkPatch(bookId, ids, changes);
      setEntries(await fetchEntries(bookId));
      toast(`Updated ${ids.length} ${ids.length === 1 ? "entry" : "entries"}`);
    } catch (err) { toast(`Failed to update the selected entries: ${(err as Error).message}`, { kind: "error" }); }
  }, [bookId, selected]);

  // ── keyboard: j/k roving focus, Enter opens, Escape backs out ──
  const onListKey = useCallback((ev: KeyboardEvent) => {
    const tag = (ev.target as HTMLElement).tagName;
    if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
    const idx = visible.findIndex((e) => e.id === focusId);
    const move = (d: number) => {
      const next = visible[Math.max(0, Math.min(visible.length - 1, (idx === -1 ? (d > 0 ? -1 : 0) : idx) + d))];
      if (next) {
        setFocusId(next.id);
        (listRef.current?.querySelector(`[data-row="${CSS.escape(next.id)}"]`) as HTMLElement | null)
          ?.focus({ preventScroll: false });
      }
    };
    if (ev.key === "j" || ev.key === "ArrowDown") { ev.preventDefault(); move(1); }
    else if (ev.key === "k" || ev.key === "ArrowUp") { ev.preventDefault(); move(-1); }
    else if ((ev.key === "Enter" || ev.key === "o") && focusId) {
      ev.preventDefault();
      if (!desktop) setOpen((s) => { const n = new Set(s); n.has(focusId) ? n.delete(focusId) : n.add(focusId); return n; });
    } else if (ev.key === "Escape") {
      if (showTags) setShowTags(false);
      else navigate("lorebooks");
    }
  }, [visible, focusId, desktop, showTags]);

  if (error) return <div class="screen"><div class="empty"><p class="t-label">Could not load</p><p class="t-data">{error}</p></div></div>;
  if (!entries || !book) return <div class="screen"><div class="empty">Loading lorebook entries…</div></div>;

  const flaggedN = entries.filter(isFlagged).length;
  const focused = entries.find((e) => e.id === focusId) ?? null;

  // ── grouped or flat row list ──
  const rows = (list: Entry[]) => list.map((e) => (
    <Row
      key={e.id}
      entry={e}
      ev={evals.get(e.id)}
      hotT={entryTokens(e) > p90}
      hotK={e.keys.length > kp90}
      mode={mode}
      selecting={selecting}
      isSelected={selected.has(e.id)}
      isOpen={!desktop && open.has(e.id)}
      isFocused={focusId === e.id}
      onActivate={() => {
        if (selecting) {
          setSelected((s) => { const n = new Set(s); n.has(e.id) ? n.delete(e.id) : n.add(e.id); return n; });
        } else if (desktop) {
          setFocusId(e.id);
        } else {
          setFocusId(e.id);
          setOpen((s) => { const n = new Set(s); n.has(e.id) ? n.delete(e.id) : n.add(e.id); return n; });
        }
      }}
      drawer={!desktop && open.has(e.id)
        ? <EntryDrawer entry={e} pill={pills[e.id]} kp90={kp90} evHits={evals.get(e.id)?.hits ?? []}
            save={save} onDelete={() => removeWithUndo(e)} onExpand={(field) => setFull({ id: e.id, field })} />
        : null}
    />
  ));

  const grouped = group
    ? [...visible.reduce((m, e) => {
        const k = (e.tag ?? "").trim() || UNTAGGED;
        m.set(k, [...(m.get(k) ?? []), e]);
        return m;
      }, new Map<string, Entry[]>()).entries()].sort((a, b) => b[1].length - a[1].length)
    : null;

  return (
    <div class={`audit ${desktop ? "is-desktop" : ""}`}>
      <div class="audit-list" ref={listRef} onKeyDown={onListKey}>
        <header class="console">
          <div class="hrow">
            <button class="icon-btn" aria-label="Back to lorebooks" onClick={() => navigate("lorebooks")}>‹</button>
            <h1 class="console-title">{book.name}</h1>
            <button class="icon-btn t-data" aria-label="Tag distribution" onClick={() => setShowTags(true)}>#</button>
          </div>

          <div class="probe">
            <div class="modeswap" role="group" aria-label="Search mode">
              <button aria-pressed={mode === "find"} onClick={() => setMode("find")}>Find</button>
              <button class="t" aria-pressed={mode === "test"} onClick={() => setMode("test")}>Test</button>
            </div>
            <div class="pwrap">
              <input
                value={query}
                placeholder={mode === "test" ? "Paste a paragraph or sample messages here…" : "Search entries…"}
                aria-label={mode === "test" ? "Keyword test text" : "Search entries"}
                onInput={(e) => setQuery(e.currentTarget.value)}
              />
              {query.trim() !== "" && (
                <span class="res">{meter.testing ? `${meter.pool.length} match` : `${visible.length} match`}</span>
              )}
            </div>
          </div>

          <div class="meter">
            <span class="t-label t-label-s">{meter.testing ? "Would activate" : "All active"}</span>
            <span class="mbar">
              <span class="m-a" style={`width:${Math.min(100, (meter.aTok / meter.budget) * 100)}%`} />
              <span class="m-k" style={`width:${Math.min(100 - Math.min(100, (meter.aTok / meter.budget) * 100), (meter.kTok / meter.budget) * 100)}%`} />
            </span>
            <span class="t-data mval">
              <b style={meter.over ? "color: var(--flag)" : undefined}>{meter.total.toLocaleString()}</b>
              <span class="of"> / {meter.budget.toLocaleString()}</span>
            </span>
          </div>

          {!selecting ? (
            <div class="chiprail">
              {(["tokens", "order", "keys", "name", "updated"] as SortKey[]).map((k) => (
                <button key={k} class="chip" aria-pressed={sort === k && !group} onClick={() => { setSort(k); setGroup(false); }}>
                  {{ tokens: "Tokens", order: "Order", keys: "Keys", name: "Title", updated: "Edited" }[k]}
                  {sort === k && !group && <span class="ar"> ↓</span>}
                </button>
              ))}
              <button class="chip" aria-pressed={group} onClick={() => setGroup(!group)}>Group by tag</button>
              <button class="chip is-flag" aria-pressed={flaggedOnly} onClick={() => setFlaggedOnly(!flaggedOnly)}>
                Flagged <b class="t-num">{flaggedN}</b>
              </button>
            </div>
          ) : (
            <div class="chiprail">
              <span class="t-data selcount">{selected.size} selected</span>
              <button class="chip" onClick={() => runBulk({ enabled: true })}>Enable</button>
              <button class="chip" onClick={() => runBulk({ enabled: false })}>Disable</button>
              <button class="chip" onClick={() => { const t = prompt("Add tag… (blank to clear)"); if (t !== null) void runBulk({ tag: t.trim() }); }}>Add tag…</button>
              <button class="chip" onClick={() => { setSelecting(false); setSelected(new Set()); }}>Done</button>
            </div>
          )}
        </header>

        <main class="rows">
          {visible.length === 0 && (
            <p class="empty">{mode === "test" ? "No entries would activate on this text." : "No entries match your search"}</p>
          )}
          {grouped
            ? grouped.map(([tag, items]) => (
                <div key={tag}>
                  <div class="grouphead">
                    <span class="t-label t-label-s gn">{tag === UNTAGGED ? "untagged" : tag}</span>
                    <span class="meta"><span>{items.length}</span><span>{items.reduce((a, e) => a + entryTokens(e), 0).toLocaleString()}t</span></span>
                    <button class="chip" onClick={() => { setSelecting(true); setSelected((s) => new Set([...s, ...items.map((e) => e.id)])); }}>Select</button>
                  </div>
                  {rows(items)}
                </div>
              ))
            : rows(visible)}
        </main>

        <nav class="dock-actions">
          <button class="dbtn" onClick={() => { setSelecting(!selecting); if (selecting) setSelected(new Set()); }}>☰ Select</button>
          <button class="dbtn" onClick={() => setShowTags(true)}># Tags</button>
          <button class="dbtn is-primary" onClick={addEntry}>＋ Add Entry</button>
        </nav>
      </div>

      {desktop && (
        <aside class="audit-detail">
          {focused ? (
            <EntryDrawer entry={focused} pill={pills[focused.id]} kp90={kp90}
              evHits={evals.get(focused.id)?.hits ?? []}
              save={save} onDelete={() => removeWithUndo(focused)}
              onExpand={(field) => setFull({ id: focused.id, field })} />
          ) : (
            <div class="empty">Select an entry — <span class="t-data">j/k</span> to move, <span class="t-data">Enter</span> to edit.</div>
          )}
        </aside>
      )}

      {showTags && (
        <TagOverlay
          entries={entries}
          onClose={() => setShowTags(false)}
          onShow={(tag) => { setMode("find"); setQuery(tag === UNTAGGED ? "" : tag); setGroup(true); setShowTags(false); }}
          onSelect={(ids) => { setSelecting(true); setSelected(new Set(ids)); setShowTags(false); }}
        />
      )}

      {full && (() => {
        const e = entries.find((x) => x.id === full.id);
        return e ? (
          <FullscreenText
            title={full.field === "content" ? "Edit Content" : "Edit Description"}
            subtitle={e.name} initial={String(e[full.field] ?? "")} budget={book.tokenBudget}
            onDone={(value) => { save(full.id, { [full.field]: value }, true); setFull(null); }}
          />
        ) : null;
      })()}
    </div>
  );
}

// ── collapsed row ──
function Row(props: {
  entry: Entry; ev?: Evaluation; hotT: boolean; hotK: boolean; mode: Mode;
  selecting: boolean; isSelected: boolean; isOpen: boolean; isFocused: boolean;
  onActivate: () => void; drawer: ComponentChildren;
}) {
  const { entry: e, ev, hotT, hotK } = props;
  const status = statusOf(e);
  const idle = ev?.tested && !ev.fires;
  const keyline = e.constant
    ? <span class="k-const">always injected — keys ignored</span>
    : e.keys.length
      ? e.keys.slice(0, 6).map((k, i) => (
          <span key={i}>
            {i > 0 && <i class="sep" data-contrast-exempt>·</i>}
            <span class={ev?.hits.includes(k) ? "k-hit" : undefined}>{k}</span>
          </span>
        ))
      : <span class="k-none">no keys — never fires</span>;

  return (
    <article class={`row ${props.isOpen ? "is-open" : ""} ${props.isSelected ? "is-selected" : ""} ${idle ? "is-idle" : ""} ${props.isFocused ? "is-focused" : ""}`} data-s={status}>
      <button
        class="row-summary"
        data-row={e.id}
        tabIndex={props.isFocused ? 0 : -1}
        aria-expanded={props.isOpen}
        onClick={props.onActivate}
      >
        <span class="rail-cell"><span class="dot" /><span class="ord t-data">{e.order}</span></span>
        <span class="mid">
          <span class="nm">{e.name || "Untitled entry"}</span>
          <span class="metaline">
            <span class={`tg ${!(e.tag ?? "").trim() ? "is-none" : ""}`}>{(e.tag ?? "").trim() || "untagged"}</span>
            {ev?.tested && (ev.fires ? <span class="verdict is-fire">Would activate</span> : <span class="verdict">idle</span>)}
            {e.position !== 0 && <span class="tg">{POS_COMPACT[e.position] ?? ""}</span>}
            {hotT && <span class="fl">bloated</span>}
            {hotK && <span class="fl">key-heavy</span>}
            <span class="keys t-data">{keyline}</span>
          </span>
        </span>
        <span class="num">
          <b class={`tok t-num ${hotT ? "is-hot" : ""}`}>{entryTokens(e)}</b><span class="unit t-data">tokens</span>
          <b class={`tok t-num ${hotK ? "is-hot" : ""}`}>{e.keys.length}</b><span class="unit t-data">keys</span>
        </span>
      </button>
      {props.drawer}
    </article>
  );
}

// ── tag distribution overlay ──
function TagOverlay(props: {
  entries: Entry[]; onClose: () => void;
  onShow: (tag: string) => void; onSelect: (ids: string[]) => void;
}) {
  const stats = tagStats(props.entries);
  const max = Math.max(...stats.map((s) => s.n), 1);
  return (
    <div class="tagpanel">
      <div class="hrow">
        <button class="icon-btn" aria-label="Back to entries" onClick={props.onClose}>‹</button>
        <h2 class="console-title">Tags</h2>
        <span class="meta"><span>{stats.length}</span><span>{props.entries.length} entries</span></span>
      </div>
      {stats.map((s) => (
        <div key={s.tag} class="trow">
          <div>
            <div class={`tn ${s.tag === UNTAGGED ? "is-none" : ""}`}>{s.tag === UNTAGGED ? "untagged" : s.tag}</div>
            <div class="meta">
              <span>{s.n} {s.n === 1 ? "entry" : "entries"}</span>
              <span>{s.tokens.toLocaleString()} tokens (est.)</span>
              {s.constant > 0 && <span>{s.constant} constant</span>}
              {s.disabled > 0 && <span>{s.disabled} disabled</span>}
            </div>
          </div>
          <div class="tacts">
            <button class="chip" onClick={() => props.onShow(s.tag)}>Show</button>
            <button class="chip" onClick={() => props.onSelect(s.ids)}>Select</button>
          </div>
          <div class="tbar"><i style={`width:${(s.n / max) * 100}%`} /></div>
        </div>
      ))}
    </div>
  );
}
