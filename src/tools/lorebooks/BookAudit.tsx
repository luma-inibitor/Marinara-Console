// The audit screen: console header (Find/Test probe, budget meter, sort chips),
// audit rows, bulk select, tag panel, and the entry editor — inline accordion on
// mobile, master-detail side panel on desktop (DESIGN.md §6).
import type { KeyboardEvent as ReactKeyboardEvent, ReactNode } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { navigate } from "../../shell/router";
import { openOverlay, closeTopOverlay } from "../../shell/overlays";
import { toast } from "../../shell/toast";
import {
  type Entry,
  type Lorebook,
  type Evaluation,
  entryTokens,
  statusOf,
  percentile,
  evaluate,
  matchesQuery,
  tagStats,
  fetchBooks,
  fetchEntries,
  patchEntry,
  createEntry,
  deleteEntry,
  bulkPatch,
  POS_COMPACT,
  UNTAGGED,
} from "./data";
import { EntryDrawer, type FullscreenCtx } from "./entries";
import { useDraft } from "../../shell/draft";
import { FullscreenText } from "../../ui/FullscreenText";
import {
  Button,
  Chip,
  EmptyState,
  ErrorState,
  ListEmpty,
  Loading,
  NotFound,
  useIsDesktop,
  useRovingFocus,
} from "../../ui";
import { t, tAny } from "../../copy";
import { Add, Back, ICON_SIZE, SelectMode, Tags } from "../../ui/icons";

type SortKey = "tokens" | "order" | "keys" | "name" | "updated";
type Mode = "find" | "test";

/** Sort chip labels, as copy keys — a table, so it goes through t() by key. */
const SORT_LABEL: Record<SortKey, string> = {
  tokens: "lorebooks.unitTokens",
  order: "lorebooks.field.order",
  keys: "lorebooks.field.keys",
  name: "lorebooks.sort.title",
  updated: "lorebooks.sort.edited",
};

export function BookAudit({ bookId, initialEntryId }: { bookId: string; initialEntryId?: string }) {
  const desktop = useIsDesktop();
  const [book, setBook] = useState<Lorebook | null>(null);
  const [entries, setEntries] = useState<Entry[] | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [missing, setMissing] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  const [mode, setMode] = useState<Mode>("find");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortKey>("tokens");
  const [group, setGroup] = useState(false);
  const [flaggedOnly, setFlaggedOnly] = useState(false);
  const [open, setOpen] = useState<Set<string>>(new Set()); // mobile inline drawers (multi-expand)
  const [focusId, setFocusId] = useState<string | null>(null); // desktop detail target + keyboard focus
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showTags, setShowTags] = useState(false);
  const [full, setFull] = useState<FullscreenCtx | null>(null);

  const listRef = useRef<HTMLDivElement>(null);

  // deep link from the palette: focus + reveal a specific entry once loaded
  useEffect(() => {
    if (!entries || !initialEntryId) return;
    if (!entries.some((e) => e.id === initialEntryId)) return;
    setFocusId(initialEntryId);
    setOpen((s) => new Set(s).add(initialEntryId));
    const frame = requestAnimationFrame(() => {
      (
        listRef.current?.querySelector(`[data-row="${CSS.escape(initialEntryId)}"]`) as HTMLElement | null
      )?.scrollIntoView({ block: "center" });
    });
    return () => cancelAnimationFrame(frame);
  }, [entries, initialEntryId]);

  useEffect(() => {
    let alive = true;
    setBook(null);
    setEntries(null);
    setError(null);
    setMissing(false);
    (async () => {
      try {
        const [books, es] = await Promise.all([fetchBooks(), fetchEntries(bookId)]);
        if (!alive) return;
        const b = books.find((x) => x.id === bookId);
        if (!b) {
          setMissing(true);
          return;
        } // the entries endpoint 200s with [] for an unknown id
        setBook(b);
        setEntries(es);
      } catch (e) {
        if (alive) setError(e);
      }
    })();
    return () => {
      alive = false;
    };
  }, [bookId, reloadKey]);

  // ── derived ──
  const p90 = useMemo(() => percentile((entries ?? []).map(entryTokens), 0.9), [entries]);
  const kp90 = useMemo(
    () =>
      percentile(
        (entries ?? []).map((e) => e.keys.length),
        0.9,
      ),
    [entries],
  );
  const isFlagged = useCallback((e: Entry) => entryTokens(e) > p90 || e.keys.length > kp90, [p90, kp90]);

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
        const fa = evals.get(a.id)?.fires ? 1 : 0,
          fb = evals.get(b.id)?.fires ? 1 : 0;
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

  // ── editing: one explicit-save draft at a time ──
  // Nothing is written until Save. A rejected save keeps the draft, so the UI
  // never shows a value the engine refused; a concurrent write is detected and
  // surfaced instead of silently clobbering the other client.
  const editingEntry = useMemo(() => (entries ?? []).find((e) => e.id === editingId) ?? null, [entries, editingId]);

  const draft = useDraft<Entry>(editingEntry, {
    commit: async (patch) => {
      const updated = await patchEntry(bookId, editingId!, patch as Record<string, unknown>);
      const merged = { ...(editingEntry as Entry), ...patch, ...(updated ?? {}) } as Entry;
      setEntries((es) => (es ?? []).map((e) => (e.id === merged.id ? merged : e)));
      return merged;
    },
    refetch: async () => {
      const fresh = await fetchEntries(bookId);
      const mine = fresh.find((e) => e.id === editingId);
      if (!mine) throw new Error(t("lorebooks.entry.gone"));
      setEntries(fresh);
      return mine;
    },
  });

  // Bind the draft to whatever drawer is actually on screen. Adopting lazily on
  // first keystroke loses that keystroke — onBeginEdit sets state, so the draft
  // does not exist yet in the same render and the value is dropped.
  useEffect(() => {
    const target = desktop ? focusId : null;
    if (!target || target === editingId) return;
    if (draft.dirty) return; // keep the open draft; beginEdit reports the conflict
    setEditingId(target);
  }, [desktop, focusId, editingId, draft.dirty]);

  /** Begin editing an entry, guarding an unsaved draft on another one. */
  const beginEdit = useCallback(
    (id: string) => {
      if (id === editingId) return;
      if (draft.dirty) {
        toast(
          t("lorebooks.record.saveOrDiscardFirst", {
            name: editingEntry?.name || t("lorebooks.entry.thisEntry"),
          }),
          { kind: "error" },
        );
        return;
      }
      setEditingId(id);
    },
    [editingId, draft.dirty, editingEntry],
  );

  const saveDraft = useCallback(async () => {
    const ok = await draft.save();
    if (ok) toast(t("lorebooks.entry.saved"));
    return ok;
  }, [draft]);

  // Guard a browser-level navigation away from unsaved work.
  useEffect(() => {
    if (!draft.dirty) return;
    const warn = (ev: BeforeUnloadEvent) => {
      ev.preventDefault();
      ev.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [draft.dirty]);

  // ── delete with undo (soft: DELETE fires when the toast expires) ──
  const removeWithUndo = useCallback(
    (entry: Entry) => {
      setEntries((es) => (es ?? []).filter((e) => e.id !== entry.id));
      setOpen((s) => {
        const n = new Set(s);
        n.delete(entry.id);
        return n;
      });
      if (focusId === entry.id) setFocusId(null);
      toast(t("lorebooks.record.deleted", { name: entry.name }), {
        actionLabel: t("lorebooks.record.undo"),
        onAction: () => {
          // restore locally; entry still exists server-side (nothing sent yet)
          setEntries((es) => [...(es ?? []), entry]);
        },
        onExpire: () => {
          deleteEntry(bookId, entry.id).catch((err: Error) => {
            toast(t("lorebooks.record.deleteFailed", { message: err.message }), { kind: "error" });
            setEntries((es) => [...(es ?? []), entry]);
          });
        },
      });
    },
    [bookId, focusId],
  );

  const addEntry = useCallback(async () => {
    const name = prompt(t("lorebooks.entry.add"), t("lorebooks.entry.addDefaultName"));
    if (!name?.trim()) return;
    try {
      const created = await createEntry(bookId, { name: name.trim(), content: "", keys: [] });
      setEntries((es) => [...(es ?? []), created]);
      setFocusId(created.id);
      setOpen((s) => new Set(s).add(created.id));
    } catch (err) {
      toast(t("lorebooks.entry.addFailed", { message: (err as Error).message }), { kind: "error" });
    }
  }, [bookId]);

  const runBulk = useCallback(
    async (changes: Record<string, unknown>) => {
      const ids = [...selected];
      if (!ids.length) {
        toast(t("lorebooks.bulk.nothingSelected"), { kind: "error" });
        return;
      }
      try {
        await bulkPatch(bookId, ids, changes);
        setEntries(await fetchEntries(bookId));
        toast(t("lorebooks.bulk.updated", { count: ids.length }));
      } catch (err) {
        toast(t("lorebooks.bulk.updateFailed", { message: (err as Error).message }), { kind: "error" });
      }
    },
    [bookId, selected],
  );

  // The tag panel is a full-screen surface, not a `<Sheet>`, so it has to hold
  // up its own half of the overlay contract: flip the state, then register a
  // closer. Without it the back gesture walks past the panel and leaves the
  // lorebook, which on a phone is the only dismissal gesture there is.
  useEffect(() => {
    if (!showTags) return;
    return openOverlay(() => setShowTags(false));
  }, [showTags]);

  // ── keyboard: j/k roving focus, Enter opens, Escape backs out ──
  // The modifier guards live in useRovingFocus; do not re-implement them here.
  const roving = useRovingFocus({
    listRef,
    keys: visible.map((e) => e.id),
    current: focusId,
    onFocus: setFocusId,
  });
  const onListKey = useCallback(
    (ev: ReactKeyboardEvent<HTMLDivElement>) => {
      if (roving.ignore(ev)) return;
      if (ev.key === "j" || ev.key === "ArrowDown") {
        ev.preventDefault();
        roving.move(1);
      } else if (ev.key === "k" || ev.key === "ArrowUp") {
        ev.preventDefault();
        roving.move(-1);
      } else if ((ev.key === "Enter" || ev.key === "o") && focusId) {
        ev.preventDefault();
        if (!desktop)
          setOpen((s) => {
            const n = new Set(s);
            n.has(focusId) ? n.delete(focusId) : n.add(focusId);
            return n;
          });
      } else if (ev.key === "Escape") {
        // Only reached when nothing is stacked: the overlay stack's own capture
        // listener swallows Escape while the tag panel is open. Closing it here
        // as well would pop two history entries and drop the reader out of the book.
        navigate("lorebooks");
      }
    },
    [roving, focusId, desktop],
  );

  if (missing)
    return (
      <div className="screen">
        <NotFound what="lorebooks.book" id={bookId} />
      </div>
    );
  if (error)
    return (
      <div className="screen">
        <ErrorState error={error} onRetry={() => setReloadKey((k) => k + 1)} />
      </div>
    );
  if (!entries || !book) {
    return (
      <div className="screen">
        <Loading what="lorebooks.entries" onRetry={() => setReloadKey((k) => k + 1)} />
      </div>
    );
  }

  const flaggedN = entries.filter(isFlagged).length;
  const focused = entries.find((e) => e.id === focusId) ?? null;

  // ── grouped or flat row list ──
  const rows = (list: Entry[]) =>
    list.map((e) => (
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
            setSelected((s) => {
              const n = new Set(s);
              n.has(e.id) ? n.delete(e.id) : n.add(e.id);
              return n;
            });
          } else if (desktop) {
            setFocusId(e.id);
          } else {
            setFocusId(e.id);
            setOpen((s) => {
              const n = new Set(s);
              n.has(e.id) ? n.delete(e.id) : (n.add(e.id), beginEdit(e.id));
              return n;
            });
          }
        }}
        drawer={
          !desktop && open.has(e.id) ? (
            <EntryDrawer
              entry={e.id === editingId ? draft.value : e}
              draft={e.id === editingId ? draft : null}
              kp90={kp90}
              evHits={evals.get(e.id)?.hits ?? []}
              onBeginEdit={() => beginEdit(e.id)}
              onSave={saveDraft}
              onDelete={() => removeWithUndo(e)}
              onExpand={(field) => setFull({ id: e.id, field })}
            />
          ) : null
        }
      />
    ));

  const grouped = group
    ? [
        ...visible
          .reduce((m, e) => {
            const k = (e.tag ?? "").trim() || UNTAGGED;
            m.set(k, [...(m.get(k) ?? []), e]);
            return m;
          }, new Map<string, Entry[]>())
          .entries(),
      ].sort((a, b) => b[1].length - a[1].length)
    : null;

  return (
    <div className={`audit ${desktop ? "is-desktop" : ""}`}>
      <div className="audit-list" ref={listRef} onKeyDown={onListKey}>
        <header className="console">
          <div className="hrow">
            <Button
              iconOnly
              label={t("lorebooks.record.backToBooks")}
              onClick={() => navigate("lorebooks")}
              icon={<Back size={ICON_SIZE.xl} stroke={1.75} aria-hidden />}
            />
            <h1 className="console-title">{book.name}</h1>
            <Button
              iconOnly
              label={t("lorebooks.tag.distribution")}
              onClick={() => setShowTags(true)}
              icon={<Tags size={ICON_SIZE.xl} stroke={1.75} aria-hidden />}
            />
          </div>

          <div className="probe">
            <div className="modeswap" role="group" aria-label={t("lorebooks.probe.modeGroup")}>
              <button aria-pressed={mode === "find"} onClick={() => setMode("find")}>
                {t("lorebooks.probe.find")}
              </button>
              <button className="t" aria-pressed={mode === "test"} onClick={() => setMode("test")}>
                {t("lorebooks.probe.test")}
              </button>
            </div>
            <div className="pwrap">
              <input
                value={query}
                placeholder={t(mode === "test" ? "lorebooks.probe.testPlaceholder" : "lorebooks.probe.findPlaceholder")}
                aria-label={t(mode === "test" ? "lorebooks.probe.testLabel" : "lorebooks.probe.findLabel")}
                onInput={(e) => setQuery(e.currentTarget.value)}
              />
              {query.trim() !== "" && (
                <span className="res">
                  {t("ui.search.matches", { count: meter.testing ? meter.pool.length : visible.length })}
                </span>
              )}
            </div>
          </div>

          <div className="meter">
            <span className="t-label t-label-s">
              {t(meter.testing ? "lorebooks.meter.wouldActivate" : "lorebooks.meter.allActive")}
            </span>
            <span className="mbar">
              <span className="m-a" style={{ width: `${Math.min(100, (meter.aTok / meter.budget) * 100)}%` }} />
              <span
                className="m-k"
                style={{
                  width: `${Math.min(100 - Math.min(100, (meter.aTok / meter.budget) * 100), (meter.kTok / meter.budget) * 100)}%`,
                }}
              />
            </span>
            <span className="t-data mval">
              <b style={meter.over ? { color: "var(--flag)" } : undefined}>{meter.total.toLocaleString()}</b>
              <span className="of"> / {meter.budget.toLocaleString()}</span>
            </span>
          </div>

          {!selecting ? (
            <div className="chiprail">
              {(["tokens", "order", "keys", "name", "updated"] as SortKey[]).map((k) => (
                <Chip
                  key={k}
                  pressed={sort === k && !group}
                  onClick={() => {
                    setSort(k);
                    setGroup(false);
                  }}
                >
                  {tAny(SORT_LABEL[k])}
                  {sort === k && !group && <span className="ar"> ↓</span>}
                </Chip>
              ))}
              <Chip pressed={group} onClick={() => setGroup(!group)}>
                {t("lorebooks.filter.group")}
              </Chip>
              <Chip flag pressed={flaggedOnly} onClick={() => setFlaggedOnly(!flaggedOnly)}>
                {t("lorebooks.filter.flagged")} <b className="t-num">{flaggedN}</b>
              </Chip>
            </div>
          ) : (
            <div className="chiprail">
              <span className="t-data selcount">{t("lorebooks.bulk.selected", { count: selected.size })}</span>
              <Chip onClick={() => runBulk({ enabled: true })}>{t("lorebooks.bulk.enable")}</Chip>
              <Chip onClick={() => runBulk({ enabled: false })}>{t("lorebooks.bulk.disable")}</Chip>
              <Chip
                onClick={() => {
                  const tag = prompt(t("lorebooks.bulk.addTagPrompt"));
                  if (tag !== null) void runBulk({ tag: tag.trim() });
                }}
              >
                {t("lorebooks.bulk.addTag")}
              </Chip>
              <Chip
                onClick={() => {
                  setSelecting(false);
                  setSelected(new Set());
                }}
              >
                {t("lorebooks.bulk.done")}
              </Chip>
            </div>
          )}
        </header>

        <main className="rows">
          {visible.length === 0 &&
            (mode === "test" ? (
              <EmptyState title={t("lorebooks.empty.testTitle")} body={t("lorebooks.empty.testBody")} />
            ) : entries.length === 0 ? (
              <ListEmpty
                kind="first-run"
                what="lorebooks.entries"
                action={{ label: t("lorebooks.entry.add"), run: addEntry }}
              />
            ) : (
              <ListEmpty
                kind="filtered"
                what="lorebooks.entries"
                filters={[
                  ...(query.trim()
                    ? [
                        {
                          label: t("memoryvault.filteredEmptySearch", { value1: query.trim() }),
                          clear: () => setQuery(""),
                        },
                      ]
                    : []),
                  ...(flaggedOnly
                    ? [{ label: t("lorebooks.filter.flaggedOnly"), clear: () => setFlaggedOnly(false) }]
                    : []),
                ]}
                onClearAll={() => {
                  setQuery("");
                  setFlaggedOnly(false);
                }}
              />
            ))}
          {grouped
            ? grouped.map(([tag, items]) => (
                <div key={tag}>
                  <div className="grouphead">
                    <span className="t-label t-label-s gn">{tag === UNTAGGED ? t("lorebooks.untagged") : tag}</span>
                    <span className="meta">
                      <span>{items.length}</span>
                      <span>{items.reduce((a, e) => a + entryTokens(e), 0).toLocaleString()}t</span>
                    </span>
                    <Chip
                      onClick={() => {
                        setSelecting(true);
                        setSelected((s) => new Set([...s, ...items.map((e) => e.id)]));
                      }}
                    >
                      {t("lorebooks.bulk.select")}
                    </Chip>
                  </div>
                  {rows(items)}
                </div>
              ))
            : rows(visible)}
        </main>

        <nav className="dock-actions">
          <button
            className="dbtn"
            onClick={() => {
              setSelecting(!selecting);
              if (selecting) setSelected(new Set());
            }}
          >
            <SelectMode size={ICON_SIZE.md} stroke={1.75} aria-hidden />
            {t("lorebooks.bulk.select")}
          </button>
          <button className="dbtn" onClick={() => setShowTags(true)}>
            <Tags size={ICON_SIZE.md} stroke={1.75} aria-hidden />
            {t("lorebooks.tags")}
          </button>
          <button className="dbtn is-primary" onClick={addEntry}>
            <Add size={ICON_SIZE.md} stroke={1.75} aria-hidden />
            {t("lorebooks.entry.add")}
          </button>
        </nav>
      </div>

      {desktop && (
        <aside className="audit-detail">
          {focused ? (
            <EntryDrawer
              entry={focused.id === editingId ? draft.value : focused}
              draft={focused.id === editingId ? draft : null}
              kp90={kp90}
              evHits={evals.get(focused.id)?.hits ?? []}
              onBeginEdit={() => beginEdit(focused.id)}
              onSave={saveDraft}
              onDelete={() => removeWithUndo(focused)}
              onExpand={(field) => setFull({ id: focused.id, field })}
            />
          ) : (
            <EmptyState
              title={t("lorebooks.detail.selectPrompt")}
              body={<span className="t-data">{t("lorebooks.detail.keyboardHint")}</span>}
            />
          )}
        </aside>
      )}

      {showTags && (
        <TagOverlay
          entries={entries}
          onClose={closeTopOverlay}
          onShow={(tag) => {
            setMode("find");
            setQuery(tag === UNTAGGED ? "" : tag);
            setGroup(true);
            closeTopOverlay();
          }}
          onSelect={(ids) => {
            setSelecting(true);
            setSelected(new Set(ids));
            closeTopOverlay();
          }}
        />
      )}

      {full &&
        (() => {
          const e = full.id === editingId ? draft.value : entries.find((x) => x.id === full.id);
          return e ? (
            <FullscreenText
              title={t(full.field === "content" ? "lorebooks.record.editContent" : "lorebooks.record.editDescription")}
              subtitle={e.name}
              initial={String(e[full.field] ?? "")}
              budget={book.tokenBudget}
              onDone={(value) => {
                beginEdit(full.id);
                draft.set(full.field, value);
                setFull(null);
              }}
              onCancel={() => setFull(null)}
            />
          ) : null;
        })()}
    </div>
  );
}

// ── collapsed row ──
function Row(props: {
  entry: Entry;
  ev?: Evaluation;
  hotT: boolean;
  hotK: boolean;
  mode: Mode;
  selecting: boolean;
  isSelected: boolean;
  isOpen: boolean;
  isFocused: boolean;
  onActivate: () => void;
  drawer: ReactNode;
}) {
  const { entry: e, ev, hotT, hotK } = props;
  const status = statusOf(e);
  const idle = ev?.tested && !ev.fires;
  const keyline = e.constant ? (
    <span className="k-const">{t("lorebooks.row.alwaysInjected")}</span>
  ) : e.keys.length ? (
    e.keys.slice(0, 6).map((k, i) => (
      <span key={i}>
        {i > 0 && (
          <i className="sep" data-contrast-exempt>
            ·
          </i>
        )}
        <span className={ev?.hits.includes(k) ? "k-hit" : undefined}>{k}</span>
      </span>
    ))
  ) : (
    <span className="k-none">{t("lorebooks.row.noKeys")}</span>
  );

  return (
    <article
      className={`row ${props.isOpen ? "is-open" : ""} ${props.isSelected ? "is-selected" : ""} ${idle ? "is-idle" : ""} ${props.isFocused ? "is-focused" : ""}`}
      data-s={status}
    >
      <button
        className="row-summary"
        data-row={e.id}
        tabIndex={props.isFocused ? 0 : -1}
        aria-expanded={props.isOpen}
        onClick={props.onActivate}
      >
        <span className="rail-cell">
          <span className="dot" />
          <span className="ord t-data">{e.order}</span>
        </span>
        <span className="mid">
          <span className="nm">{e.name || t("lorebooks.entry.untitled")}</span>
          <span className="metaline">
            <span className={`tg ${!(e.tag ?? "").trim() ? "is-none" : ""}`}>
              {(e.tag ?? "").trim() || t("lorebooks.untagged")}
            </span>
            {ev?.tested &&
              (ev.fires ? (
                <span className="verdict is-fire">{t("lorebooks.meter.wouldActivate")}</span>
              ) : (
                <span className="verdict">{t("lorebooks.row.idle")}</span>
              ))}
            {e.position !== 0 && <span className="tg">{POS_COMPACT[e.position] ?? ""}</span>}
            {hotT && <span className="fl">{t("lorebooks.row.bloated")}</span>}
            {hotK && <span className="fl">{t("lorebooks.row.keyHeavy")}</span>}
            <span className="keys t-data">{keyline}</span>
          </span>
        </span>
        <span className="num">
          <b className={`tok t-num ${hotT ? "is-hot" : ""}`}>{entryTokens(e)}</b>
          <span className="unit t-data">{t("lorebooks.unitTokens")}</span>
          <b className={`tok t-num ${hotK ? "is-hot" : ""}`}>{e.keys.length}</b>
          <span className="unit t-data">{t("lorebooks.field.keys")}</span>
        </span>
      </button>
      {props.drawer}
    </article>
  );
}

// ── tag distribution overlay ──
function TagOverlay(props: {
  entries: Entry[];
  onClose: () => void;
  onShow: (tag: string) => void;
  onSelect: (ids: string[]) => void;
}) {
  const stats = tagStats(props.entries);
  const max = Math.max(...stats.map((s) => s.n), 1);
  return (
    <div className="tagpanel">
      <div className="hrow">
        <Button
          iconOnly
          label={t("lorebooks.tag.backToEntries")}
          onClick={props.onClose}
          icon={<Back size={ICON_SIZE.xl} stroke={1.75} aria-hidden />}
        />
        <h2 className="console-title">{t("lorebooks.tags")}</h2>
        <span className="meta">
          <span>{stats.length}</span>
          <span>{t("lorebooks.entryCount", { count: props.entries.length })}</span>
        </span>
      </div>
      {stats.map((s) => (
        <div key={s.tag} className="trow">
          <div>
            <div className={`tn ${s.tag === UNTAGGED ? "is-none" : ""}`}>
              {s.tag === UNTAGGED ? t("lorebooks.untagged") : s.tag}
            </div>
            <div className="meta">
              <span>{t("lorebooks.entryCount", { count: s.n })}</span>
              <span>
                {s.tokens.toLocaleString()} {t("ui.editor.tokensEst")}
              </span>
              {s.constant > 0 && <span>{t("lorebooks.tag.constantCount", { count: s.constant })}</span>}
              {s.disabled > 0 && <span>{t("lorebooks.tag.disabledCount", { count: s.disabled })}</span>}
            </div>
          </div>
          <div className="tacts">
            <Chip onClick={() => props.onShow(s.tag)}>{t("lorebooks.tag.show")}</Chip>
            <Chip onClick={() => props.onSelect(s.ids)}>{t("lorebooks.bulk.select")}</Chip>
          </div>
          <div className="tbar">
            <i style={{ width: `${(s.n / max) * 100}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}
