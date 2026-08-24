// Prompt preset browser + editor. Order is THE attribute of a prompt preset,
// so the status rail carries the ordinal.
import { Chip, EmptyState, IconButton, Loading, ErrorState, ListEmpty, NotFound } from "../../ui";
import { Add, Back, Duplicate, Fullscreen, ICON_SIZE, SetDefault } from "../../ui/icons";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { KeyboardEvent as ReactKeyboardEvent, ReactNode } from "react";
import { navigate } from "../../shell/router";
import { toast } from "../../shell/toast";
import { useDraft, type Draft } from "../../shell/draft";
import { ApiError } from "../../shell/api";
import { tokensOf } from "../../shell/api";
import { FullscreenText } from "../../ui/FullscreenText";
import { t, tAny } from "../../copy";
import {
  type PresetFull, type PromptPreset, type PromptSection, type PresetLoad,
  fetchPresets, fetchFull, patchPreset, patchSection, createSection, deleteSection,
  duplicatePreset, setDefaultPreset,
  orderedSections, presetLoad, sectionTokens, isMarker, markerLabel,
  effectivelyEnabled, expand, groupRunBoundaries,
} from "./data";

export function PresetsTool({ rest }: { rest: string[] }) {
  const id = rest[0];
  return id ? <Editor presetId={id} key={id} /> : <Browser />;
}

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

// ── copy shared with the lorebook tool, deliberately NOT routed here ──
// "Description", "Content", "Advanced", "Edit in full screen" and "all default"
// live in src/copy/lorebooks.json (lorebooks.entry.*, lorebooks.record.*) and are
// the drawer-and-editor vocabulary BOTH tools use. Do NOT re-coin them under
// presets.*: one string under two keys is exactly what checkCatalog rejects.
// They stay literals here, and copycheck resolves them against the lorebooks
// entries.

// ══ browser ══════════════════════════════════════════════════════
type BrowserSort = "tokens" | "sections" | "name";

/** Sort chips, by the copy key that labels each. */
const SORT_KEY: Record<BrowserSort, string> = {
  tokens: "presets.tokens",
  sections: "ui.sections",
  name: "presets.name",
};

function Browser() {
  const [presets, setPresets] = useState<PromptPreset[] | null>(null);
  const [loads, setLoads] = useState<Record<string, PresetLoad | "error">>({});
  const [error, setError] = useState<unknown>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const reload = () => setReloadKey((k) => k + 1);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<BrowserSort>("tokens");

  useEffect(() => {
    let alive = true;
    setPresets(null); setError(null);
    fetchPresets().then((list) => {
      if (!alive) return;
      setPresets(list);
      for (const p of list) {
        fetchFull(p.id)
          .then((full) => { if (alive) setLoads((s) => ({ ...s, [p.id]: presetLoad(full, "conversation") })); })
          .catch(() => { if (alive) setLoads((s) => ({ ...s, [p.id]: "error" })); });
      }
    }).catch((e: unknown) => { if (alive) setError(e); });
    return () => { alive = false; };
  }, [reloadKey]);

  if (error) return <div className="screen is-narrow"><ErrorState error={error} onRetry={reload} /></div>;
  if (!presets) return <div className="screen is-narrow"><Loading what="presets" onRetry={reload} /></div>;

  const visible = presets
    .filter((p) => !query.trim() || (p.name + " " + p.description + " " + p.author).toLowerCase().includes(query.toLowerCase()))
    .sort((a, b) => {
      const la = loads[a.id], lb = loads[b.id];
      const ta = la && la !== "error" ? la.total : 0, tb = lb && lb !== "error" ? lb.total : 0;
      if (sort === "tokens") return tb - ta;
      if (sort === "sections") return (lb !== "error" && lb ? lb.totalSections : 0) - (la !== "error" && la ? la.totalSections : 0);
      return a.name.localeCompare(b.name);
    });

  const grand = presets.reduce((a, p) => {
    const l = loads[p.id];
    return a + (l && l !== "error" ? l.total : 0);
  }, 0);

  return (
    <div className="screen is-narrow">
      <div className="screen-head">
        <h1 className="screen-title">{t("shell.tool.presets")}</h1>
        <span className="meta">
          <span>{t("presets.count", { count: presets.length })}</span>
          {grand > 0 && <span><b className="t-num">{grand.toLocaleString()}</b> {t("presets.tokensTotal")}</span>}
        </span>
      </div>

      <div className="probe">
        <div className="pwrap">
          <input value={query} placeholder={t("presets.search")} aria-label={t("presets.search")}
            onInput={(e) => setQuery(e.currentTarget.value)} />
          {query.trim() !== "" && <span className="res">{t("ui.search.matches", { count: visible.length })}</span>}
        </div>
      </div>
      <div className="chiprail">
        {(["tokens", "sections", "name"] as BrowserSort[]).map((k) => (
          <Chip key={k} pressed={sort === k} onClick={() => setSort(k)}>
            {tAny(SORT_KEY[k])}
            {sort === k && <span className="ar"> ↓</span>}
          </Chip>
        ))}
      </div>

      {visible.map((p) => {
        const l = loads[p.id];
        const known = l && l !== "error" ? l : null;
        const maxSeen = Math.max(...Object.values(loads).map((x) => (x && x !== "error" ? x.total : 0)), 1);
        return (
          <button key={p.id} className="card preset-card" onClick={() => navigate(`presets/${p.id}`)}>
            <div className="preset-card-main">
              <div className="card-title">
                {p.name}
                {p.isDefault && <span className="tg is-default">{t("presets.tagDefault")}</span>}
                {p.systemKey && <span className="tg">{t("presets.tagBuiltIn")}</span>}
                <span className="tg">{p.wrapFormat}</span>
              </div>
              {p.description
                ? <p className="preset-desc">{p.description}</p>
                : <p className="preset-desc is-empty">{t("presets.noDescription")}</p>}
              <div className="meta">
                <span><b className="t-num">{known ? known.totalSections : "—"}</b> {t("ui.sections")}</span>
                {known && known.enabled !== known.totalSections && (
                  <span><b className="t-num" style={{ color: "var(--text-dim)" }}>{known.totalSections - known.enabled}</b> {t("presets.off")}</span>
                )}
                {known && known.markers > 0 && <span><b className="t-num">{known.markers}</b> {t("presets.runtime")}</span>}
                {l === "error" && <span style={{ color: "var(--danger)" }}>{t("presets.loadFailed")}</span>}
              </div>
            </div>
            <div className="preset-card-gutter">
              <b className="tok t-num">{known ? known.total.toLocaleString() : "—"}</b>
              <span className="unit t-data">{t("presets.tokens")}</span>
            </div>
            {known && <div className="bar"><i style={{ width: `${(known.total / maxSeen) * 100}%` }} /></div>}
          </button>
        );
      })}
      {visible.length === 0 && (presets.length === 0
        ? <ListEmpty kind="first-run" what="presets" />
        : <ListEmpty kind="filtered" what="presets"
            filters={query.trim()
              ? [{ label: t("memoryvault.filteredEmptySearch", { value1: query.trim() }), clear: () => setQuery("") }]
              : []}
            onClearAll={() => setQuery("")} />)}
    </div>
  );
}

// ══ editor ═══════════════════════════════════════════════════════
type FsTarget =
  | { kind: "section"; id: string }
  | { kind: "preset"; field: "conversationPrompt" | "gamePrompt" | "description" };
type Pill = "dirty" | "saved" | "err";

function Editor({ presetId }: { presetId: string }) {
  const desktop = useIsDesktop();
  const [full, setFull] = useState<PresetFull | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [missing, setMissing] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const reloadEditor = () => setReloadKey((k) => k + 1);
  const [open, setOpen] = useState<Set<string>>(new Set());
  const [focusId, setFocusId] = useState<string | null>(null);
  const [pill, setPill] = useState<Pill>("saved");   // reorder only — field edits use drafts
  const [editingId, setEditingId] = useState<string | null>(null);
  const [fs, setFs] = useState<FsTarget | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  useEffect(() => {
    let alive = true;
    setFull(null); setError(null); setMissing(false);
    fetchFull(presetId).then((f) => {
      if (!alive) return;
      setFull(f);
      // Desktop detail pane is never usefully empty — select the first section.
      if (window.matchMedia("(min-width: 900px)").matches) {
        setFocusId(orderedSections(f)[0]?.id ?? null);
      }
    }).catch((e: unknown) => {
      if (!alive) return;
      // A preset id that does not exist is a dead link, not a server fault.
      if (e instanceof ApiError && e.status === 404) setMissing(true);
      else setError(e);
    });
    return () => { alive = false; };
  }, [presetId, reloadKey]);

  // flush pending debounces on unmount so a save can't be lost silently
  useEffect(() => () => {
    for (const t of timers.current.values()) clearTimeout(t);
  }, []);

  const readOnly = !!full?.preset.systemKey;
  const sections = useMemo(() => (full ? orderedSections(full) : []), [full]);
  const runs = useMemo(() => groupRunBoundaries(sections), [sections]);
  const groupName = useCallback(
    (gid: string | null) => full?.groups.find((g) => g.id === gid)?.name ?? null, [full]);
  const groupOff = useCallback(
    (gid: string | null) => !!gid && full?.groups.find((g) => g.id === gid)?.enabled === false, [full]);

  const guard = useCallback(() => {
    if (readOnly) { toast(t("presets.readOnlyToast"), { kind: "error" }); return true; }
    return false;
  }, [readOnly]);

  // ── explicit save ──
  // One section draft at a time, plus a preset-level draft. Nothing is written
  // until Save, so a rejected write cannot leave the UI showing a value the
  // engine refused, and a concurrent write is detected rather than clobbered.
  const editingSection = useMemo(
    () => sections.find((s) => s.id === editingId) ?? null, [sections, editingId]);

  const sectionDraft = useDraft<PromptSection>(editingSection, {
    commit: async (patch) => {
      const updated = await patchSection(presetId, editingId!, patch as Record<string, unknown>);
      const merged = { ...(editingSection as PromptSection), ...patch, ...((updated ?? {}) as object) } as PromptSection;
      setFull((f) => f && ({ ...f, sections: f.sections.map((x) => (x.id === merged.id ? merged : x)) }));
      return merged;
    },
    refetch: async () => {
      const fresh = await fetchFull(presetId);
      setFull(fresh);
      const mine = fresh.sections.find((x) => x.id === editingId);
      if (!mine) throw new Error(t("presets.sectionGone"));
      return mine;
    },
  });

  const presetDraft = useDraft<PromptPreset>(full?.preset ?? null, {
    commit: async (patch) => {
      await patchPreset(presetId, patch as Record<string, unknown>);
      const merged = { ...(full!.preset), ...patch } as PromptPreset;
      setFull((f) => f && ({ ...f, preset: merged }));
      return merged;
    },
    refetch: async () => { const fresh = await fetchFull(presetId); setFull(fresh); return fresh.preset; },
  });

  // Same binding rule as the lorebook drawer: the visible section owns the draft.
  useEffect(() => {
    if (!focusId || focusId === editingId) return;
    if (sectionDraft.dirty) return;
    setEditingId(focusId);
  }, [focusId, editingId, sectionDraft.dirty]);

  const beginEditSection = useCallback((sid: string) => {
    if (guard() || sid === editingId) return;
    if (sectionDraft.dirty) {
      toast(`Save or discard your changes to "${editingSection?.name || "this section"}" first.`, { kind: "error" });
      return;
    }
    setEditingId(sid);
  }, [editingId, sectionDraft.dirty, editingSection, guard]);

  useEffect(() => {
    if (!sectionDraft.dirty && !presetDraft.dirty) return;
    const warn = (ev: BeforeUnloadEvent) => { ev.preventDefault(); ev.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [sectionDraft.dirty, presetDraft.dirty]);

  /** Move by delta, or to an absolute index when `to` is given. */
  const move = useCallback((sid: string, delta: number, to?: number) => {
    if (guard() || !full) return;
    const ids = orderedSections(full).map((s) => s.id);
    const i = ids.indexOf(sid);
    const j = to ?? i + delta;
    if (i < 0 || j < 0 || j >= ids.length || j === i) return;
    ids.splice(j, 0, ids.splice(i, 1)[0]);
    const before = full.preset.sectionOrder;
    setFull((f) => f && ({ ...f, preset: { ...f.preset, sectionOrder: ids } }));
    setPill("dirty");
    patchPreset(presetId, { sectionOrder: ids })
      .then(() => setPill("saved"))
      .catch((err: Error) => {
        setPill("err");
        setFull((f) => f && ({ ...f, preset: { ...f.preset, sectionOrder: before } }));
        toast(t("presets.reorderFailed", { message: err.message }), { kind: "error" });
      });
  }, [full, presetId, guard]);

  const removeSection = useCallback((s: PromptSection) => {
    if (guard()) return;
    if (isMarker(s)) { toast(t("presets.markerDeleteBlocked"), { kind: "error" }); return; }
    setFull((f) => f && ({ ...f, sections: f.sections.filter((x) => x.id !== s.id) }));
    if (focusId === s.id) setFocusId(null);
    toast(t("presets.deleted", { name: s.name }), {
      actionLabel: t("presets.undo"),
      onAction: () => setFull((f) => f && ({ ...f, sections: [...f.sections, s] })),
      onExpire: () => {
        deleteSection(presetId, s.id).catch((err: Error) => {
          toast(t("presets.deleteFailed", { message: err.message }), { kind: "error" });
          setFull((f) => f && ({ ...f, sections: [...f.sections, s] }));
        });
      },
    });
  }, [presetId, guard, focusId]);

  /** Create inline and focus the name field. */
  const addSection = useCallback(async () => {
    if (guard()) return;
    try {
      const created = await createSection(presetId, {
        presetId, identifier: `custom_${Date.now().toString(36)}`, name: t("presets.newSectionName"), content: "",
      });
      setFull((f) => f && ({
        ...f,
        sections: [...f.sections, created],
        preset: { ...f.preset, sectionOrder: [...f.preset.sectionOrder, created.id] },
      }));
      setFocusId(created.id);
      setOpen(new Set([created.id]));
      requestAnimationFrame(() => {
        const el = document.querySelector<HTMLInputElement>(`[data-name-input="${CSS.escape(created.id)}"]`);
        el?.focus(); el?.select();
      });
    } catch (err) { toast(t("presets.addFailed", { message: (err as Error).message }), { kind: "error" }); }
  }, [presetId, guard]);

  const openRow = useCallback((s: PromptSection) => {
    setFocusId(s.id);
    if (desktop) return;
    // one-at-a-time on phones (DESIGN.md §2 exception), and reveal the row
    setOpen((o) => (o.has(s.id) ? new Set() : new Set([s.id])));
    requestAnimationFrame(() => {
      (listRef.current?.querySelector(`[data-row="${CSS.escape(s.id)}"]`) as HTMLElement | null)
        ?.scrollIntoView({ block: "start", behavior: "smooth" });
    });
  }, [desktop]);

  const onListKey = useCallback((ev: ReactKeyboardEvent<HTMLDivElement>) => {
    const tag = (ev.target as HTMLElement).tagName;
    if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
    const idx = sections.findIndex((s) => s.id === focusId);
    const moveFocus = (d: number) => {
      const next = sections[Math.max(0, Math.min(sections.length - 1, (idx === -1 ? (d > 0 ? -1 : 0) : idx) + d))];
      if (next) {
        setFocusId(next.id);
        (listRef.current?.querySelector(`[data-row="${CSS.escape(next.id)}"]`) as HTMLElement | null)?.focus();
      }
    };
    if (ev.shiftKey && (ev.key === "J" || ev.key === "K")) {           // reorder without leaving the list
      ev.preventDefault();
      if (focusId) move(focusId, ev.key === "J" ? 1 : -1);
    } else if (ev.key === "j" || ev.key === "ArrowDown") { ev.preventDefault(); moveFocus(1); }
    else if (ev.key === "k" || ev.key === "ArrowUp") { ev.preventDefault(); moveFocus(-1); }
    else if ((ev.key === "Enter" || ev.key === "o") && focusId) {
      ev.preventDefault();
      const s = sections.find((x) => x.id === focusId);
      if (s) openRow(s);
    } else if (ev.key === "Escape") navigate("presets");
  }, [sections, focusId, move, openRow]);

  if (missing) return <div className="screen"><NotFound what="Preset" id={presetId} backTo="presets" backLabel={t("presets.back")} /></div>;
  if (error) return <div className="screen"><ErrorState error={error} onRetry={reloadEditor} /></div>;
  if (!full) return <div className="screen"><Loading what="preset" onRetry={reloadEditor} /></div>;

  const conv = presetLoad(full, "conversation");
  const game = presetLoad(full, "game");
  const budget = typeof full.preset.parameters.maxContext === "number" ? full.preset.parameters.maxContext : 0;
  const focused = sections.find((s) => s.id === focusId) ?? null;
  const tokenP90 = (() => {
    const v = sections.filter((s) => !isMarker(s)).map((s) => sectionTokens(s, full.preset)).sort((a, b) => a - b);
    return v.length ? v[Math.floor(v.length * 0.9)] : 0;
  })();

  const detailFor = (s: PromptSection) => (
    <SectionDetail
      section={s} preset={full.preset} readOnly={readOnly}
      groupName={groupName(s.groupId)} groupOff={groupOff(s.groupId)}
      index={sections.indexOf(s)} total={sections.length}
      desktop={desktop}
      draft={s.id === editingId ? sectionDraft : null} onBeginEdit={() => beginEditSection(s.id)}
      onSave={async () => { const ok = await sectionDraft.save(); if (ok) toast(t("presets.sectionSaved")); return ok; }}
      onMove={move} onDelete={() => removeSection(s)}
      onExpand={() => setFs({ kind: "section", id: s.id })}
    />
  );

  const dockButtons = [
    <button key="dup" className="dbtn" onClick={() => { void duplicatePreset(presetId).then((p) => navigate(`presets/${p.id}`)); }}>
      <Duplicate size={ICON_SIZE.md} stroke={1.75} aria-hidden />{t("presets.duplicate")}
    </button>,
    !full.preset.isDefault && (
      <button key="def" className="dbtn" onClick={() => {
        void setDefaultPreset(presetId)
          .then(() => fetchFull(presetId).then(setFull))
          .catch((e: Error) => toast(t("presets.defaultFailed", { message: e.message }), { kind: "error" }));
      }}>
        <SetDefault size={ICON_SIZE.md} stroke={1.75} aria-hidden />{t("presets.setDefault")}
      </button>
    ),
    readOnly
      ? <button key="copy" className="dbtn is-primary" onClick={() => { void duplicatePreset(presetId).then((p) => navigate(`presets/${p.id}`)); }}>
          <Duplicate size={ICON_SIZE.md} stroke={1.75} aria-hidden />{t("presets.copyToEdit")}
        </button>
      : <button key="add" className="dbtn is-primary" onClick={addSection}>
          <Add size={ICON_SIZE.md} stroke={1.75} aria-hidden />{t("presets.addSection")}
        </button>,
  ].filter(Boolean) as ReactNode[];

  return (
    <div className={`audit ${desktop ? "is-desktop" : ""}`}>
      <div className="audit-list" ref={listRef} onKeyDown={onListKey}>
        <header className="console">
          <div className="hrow">
            <IconButton label={t("presets.back")} onClick={() => navigate("presets")}>
              <Back size={ICON_SIZE.xl} stroke={1.75} aria-hidden />
            </IconButton>
            <h1 className="console-title is-wrapping">{full.preset.name}</h1>
            <span className={`savepill is-${sectionDraft.dirty || presetDraft.dirty ? "dirty" : pill}`}>
              {sectionDraft.dirty || presetDraft.dirty ? t("presets.unsavedChanges")
                : pill === "dirty" ? t("presets.saving") : pill === "err" ? t("presets.saveFailed") : t("presets.saved")}
            </span>
          </div>
          <div className="tagline">
            {full.preset.isDefault && <span className="tg is-default">{t("presets.tagDefault")}</span>}
            {readOnly && <span className="tg">{t("presets.readOnlyTag")}</span>}
            <span className="meta">
              <span><b className="t-num">{conv.total.toLocaleString()}</b> {t("presets.modeConv")}</span>
              <span><b className="t-num">{game.total.toLocaleString()}</b> {t("presets.modeGame")}</span>
              <span>{conv.enabled}/{conv.totalSections} {t("presets.on")}</span>
              {conv.markers > 0 && <span>+{conv.markers} {t("presets.runtime")}</span>}
            </span>
          </div>
          {budget > 0 && (
            <div className="meter">
              <span className="t-label t-label-s">{t("presets.ofContext")}</span>
              <span className="mbar">
                <span className="m-k" style={{ width: `${Math.min(100, (conv.total / budget) * 100)}%` }} />
              </span>
              <span className="mval t-data"><b>{Math.round((conv.total / budget) * 100)}%</b><span className="of"> {t("presets.ofCount", { count: budget.toLocaleString() })}</span></span>
            </div>
          )}
          <p className="costnote t-data">{t("presets.costNote")}</p>

          <div className="segrow" role="group" aria-label={t("presets.wrapFormat")}>
            {(["xml", "markdown", "none"] as const).map((w) => (
              <button key={w} className="segbtn is-pos t-data" aria-pressed={full.preset.wrapFormat === w}
                disabled={readOnly} onClick={() => { presetDraft.set("wrapFormat", w); void presetDraft.save(); }}>{w}</button>
            ))}
          </div>
          <div className="chiprail">
            <Chip onClick={() => setFs({ kind: "preset", field: "conversationPrompt" })}>
              {t("presets.conversationPrompt")} <b className="t-num">{tokensOf(expand(full.preset.conversationPrompt, full.preset))}</b>
            </Chip>
            <Chip onClick={() => setFs({ kind: "preset", field: "gamePrompt" })}>
              {t("presets.gamePrompt")} <b className="t-num">{tokensOf(expand(full.preset.gamePrompt, full.preset))}</b>
            </Chip>
            <Chip onClick={() => setFs({ kind: "preset", field: "description" })}>Description</Chip>
          </div>
        </header>

        <main className="rows">
          {sections.length === 0 && (
            <ListEmpty kind="first-run" what="sections" />
          )}
          {sections.map((s, i) => {
            const isOpen = !desktop && open.has(s.id);
            const on = effectivelyEnabled(s, full.groups);
            const marker = isMarker(s);
            const tok = sectionTokens(s, full.preset);
            const run = runs.get(s.id);
            return (
              <article key={s.id}
                className={`row ${isOpen ? "is-open" : ""} ${focusId === s.id ? "is-focused" : ""} ${run ? `in-group is-${run}` : ""}`}
                data-s={on ? "normal" : "disabled"}>
                <button className="row-summary" data-row={s.id} tabIndex={focusId === s.id ? 0 : -1}
                  aria-expanded={isOpen} onClick={() => openRow(s)}>
                  <span className="rail-cell">
                    <span className="ord t-num">{i + 1}</span>
                    {!on && <span className="off-mark" aria-hidden="true" />}
                  </span>
                  <span className="mid">
                    <span className="nm">{s.name}</span>
                    <span className="metaline">
                      {marker && <span className="tg is-marker">{markerLabel(s)}</span>}
                      {groupName(s.groupId) && (
                        <span className={`tg ${groupOff(s.groupId) ? "is-off" : ""}`}>
                          {groupName(s.groupId)}{groupOff(s.groupId) ? ` ${t("presets.off")}` : ""}
                        </span>
                      )}
                      {!on && <span className="tg is-off">{t("presets.off")}</span>}
                      {s.injectionPosition !== "ordered" && (
                        <span className="keys t-data">{s.injectionPosition} {s.injectionDepth}</span>
                      )}
                    </span>
                  </span>
                  <span className="num">
                    {marker
                      ? <span className="tok-runtime t-data">{t("presets.runtime")}</span>
                      : <><b className={`tok t-num ${tok > tokenP90 && tokenP90 > 0 ? "is-hot" : ""}`}>{tok}</b>
                         <span className="unit t-data">{t("presets.tokens")}</span></>}
                  </span>
                </button>
                {isOpen && detailFor(s)}
              </article>
            );
          })}
        </main>

        <nav className="dock-actions" style={{ gridTemplateColumns: `repeat(${dockButtons.length}, 1fr)` }}>
          {dockButtons}
        </nav>
      </div>

      {desktop && (
        <aside className="audit-detail">
          {focused ? detailFor(focused) : (
            <EmptyState title={t("presets.noSections")} body={t("presets.noSectionsBody")} />
          )}
        </aside>
      )}

      {fs && (() => {
        if (fs.kind === "section") {
          const s = sections.find((x) => x.id === fs.id);
          return s ? (
            <FullscreenText title={t("presets.sectionContent")} subtitle={s.name} initial={s.content}
              budget={budget || undefined}
              onDone={(v) => { beginEditSection(s.id); sectionDraft.set("content", v); setFs(null); }}
              onCancel={() => setFs(null)} />
          ) : null;
        }
        // Same key per field as the chip that opened it, so the two cannot
        // disagree about the field's name.
        const titles = {
          conversationPrompt: t("presets.conversationPrompt"),
          gamePrompt: t("presets.gamePrompt"),
          description: "Description",
        } as const;
        return (
          <FullscreenText title={titles[fs.field]} subtitle={full.preset.name}
            initial={String(full.preset[fs.field] ?? "")} budget={budget || undefined}
            onDone={(v) => { presetDraft.set(fs.field as keyof PromptPreset, v); setFs(null); }}
            onCancel={() => setFs(null)} />
        );
      })()}
    </div>
  );
}

// ── section detail: real collapsible sub-accordions ──
const SUBS = ["section", "content", "advanced"] as const;
type Sub = typeof SUBS[number];

function SectionDetail(props: {
  section: PromptSection;
  preset: PromptPreset;
  readOnly: boolean;
  groupName: string | null;
  groupOff: boolean;
  index: number;
  total: number;
  desktop: boolean;
  draft: Draft<PromptSection> | null;
  onBeginEdit: () => void;
  onSave: () => Promise<boolean>;
  onMove: (id: string, delta: number, to?: number) => void;
  onDelete: () => void;
  onExpand: () => void;
}) {
  const { section: s, draft, readOnly } = props;
  // Staging an edit adopts this section as the edit target if it isn't already.
  const save = (_id: string, patch: Record<string, unknown>) => {
    if (!draft) { props.onBeginEdit(); return; }
    draft.merge(patch as Partial<PromptSection>);
  };
  const fErr = (f: string) => draft?.fieldErrors[f];
  const isDirty = (f: string) => draft?.dirtyFields.includes(f) ?? false;
  const marker = isMarker(s);
  const [openSubs, setOpenSubs] = useState<Set<Sub>>(
    () => new Set<Sub>(marker ? ["section"] : ["section", "content"]));
  const toggle = (id: Sub) => setOpenSubs((p) => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const tok = sectionTokens(s, props.preset);
  const expanded = expand(s.content, props.preset);
  const macroDelta = expanded.length - s.content.length;

  const sub = (id: Sub, label: string, summary: ReactNode, body: () => ReactNode) => {
    const isOpen = openSubs.has(id);
    return (
      <div className={`sub ${isOpen ? "is-open" : ""}`}>
        <button className="sub-head" aria-expanded={isOpen} onClick={() => toggle(id)}>
          <span className="t-label t-label-s">{label}</span>
          <span className="sub-summary t-data">{summary}</span>
          <span className="caret" aria-hidden="true">{isOpen ? "▴" : "▾"}</span>
        </button>
        {isOpen && <div className="sub-body">{body()}</div>}
      </div>
    );
  };

  const advNonDefault = [
    s.injectionPosition !== "ordered" && `${s.injectionPosition} ${s.injectionDepth}`,
    s.injectionOrder !== 100 && s.injectionOrder !== 0 && t("presets.orderN", { order: s.injectionOrder }),
    s.forbidOverrides && t("presets.noOverrides"),
    props.groupName && t("presets.groupNamed", { group: props.groupName })
      + (props.groupOff ? ` (${t("presets.off")})` : ""),
  ].filter(Boolean) as string[];

  return (
    <div className="drawer">
      {sub("section", t("presets.subSettings"),
        <><span className={s.enabled ? "is-on" : "is-off"}>{s.enabled ? t("presets.on") : t("presets.off")}</span> · {s.role} · {props.index + 1}/{props.total}</>,
        () => (
          <>
            <input className="tin" value={s.name} placeholder={t("presets.sectionName")} disabled={readOnly}
              data-name-input={s.id}
              onInput={(ev) => save(s.id, { name: ev.currentTarget.value })}
              aria-invalid={!!fErr("name")} />
            {fErr("name") && <p className="field-err t-data" role="alert">{fErr("name")}</p>}

            <div className="field">
              <span className="t-label t-label-s">{t("presets.included")}</span>
              <button className="toggle" role="switch" aria-checked={s.enabled} disabled={readOnly}
                onClick={() => save(s.id, { enabled: !s.enabled })}>
                <span className="toggle-track"><span className="toggle-thumb" /></span>
                <span className="toggle-label">{s.enabled ? t("presets.on") : t("presets.off")}</span>
              </button>
              {props.groupOff && (
                <p className="hint t-data">{t("presets.groupOffHint", { group: props.groupName ?? "" })}</p>
              )}
            </div>

            <div className="field">
              <span className="t-label t-label-s">{t("presets.role")}</span>
              <div className="segrow is-3">
                {(["system", "user", "assistant"] as const).map((r) => (
                  <button key={r} className="segbtn is-pos t-data" aria-pressed={s.role === r} disabled={readOnly}
                    onClick={() => save(s.id, { role: r })}>{r}</button>
                ))}
              </div>
            </div>

            <div className="field">
              <span className="t-label t-label-s">{t("presets.position")}</span>
              <div className="movebar">
                <button className="movebtn" disabled={readOnly || props.index === 0}
                  onClick={() => props.onMove(s.id, -1)}>↑ <span className="t-label t-label-s">{t("presets.moveUp")}</span></button>
                <span className="slot">
                  <span className="v t-num">{props.index + 1}</span>
                  <span className="c t-data">{t("presets.ofCount", { count: props.total })}</span>
                </span>
                <button className="movebtn" disabled={readOnly || props.index === props.total - 1}
                  onClick={() => props.onMove(s.id, 1)}>↓ <span className="t-label t-label-s">{t("presets.moveDown")}</span></button>
              </div>
              {props.desktop && <p className="hint t-data">{t("presets.reorderHint")}</p>}
            </div>
          </>
        ))}

      {marker
        ? sub("content", "Content", <span className="is-runtime">{t("presets.injectedAtRuntime")}</span>, () => (
            // Pass the marker label through untouched: case-folding it here
            // would be a runtime edit to copy, mangling e.g. "ID macro cards".
            <p className="prose-note">{t("presets.markerNote", { marker: markerLabel(s) ?? "" })}</p>
          ))
        : sub("content", "Content",
            <><b>{(macroDelta > 0 ? expanded.length : s.content.length).toLocaleString()}</b> {t("ui.editor.charUnit")} · <b>{tok}</b> {t("presets.tokens")}{macroDelta > 0 ? ` ${t("presets.expanded")}` : ""}</>,
            () => (
              <>
                <button className="edit-content" onClick={props.onExpand}>
                  <span className="ec-label t-label t-label-s">
                    <Fullscreen size={ICON_SIZE.sm} stroke={2} aria-hidden />Edit in full screen
                  </span>
                  <span className="ec-meta t-data">{s.content.length.toLocaleString()} {t("presets.chRaw")}</span>
                </button>
                {props.desktop && (
                  <textarea className="ta is-mono is-fill" value={s.content} disabled={readOnly}
                    onInput={(ev) => save(s.id, { content: ev.currentTarget.value })} />
                )}
                {!props.desktop && s.content && (
                  <p className="content-preview t-data">{s.content.slice(0, 160)}{s.content.length > 160 ? "…" : ""}</p>
                )}
                {macroDelta > 0 && (
                  <p className="hint t-data">
                    {t("presets.macroHint", {
                      expanded: expanded.length.toLocaleString(),
                      delta: macroDelta.toLocaleString(),
                    })}
                  </p>
                )}
              </>
            ))}

      {sub("advanced", "Advanced",
        advNonDefault.length
          ? t("presets.advSet", { count: advNonDefault.length })
          : "all default",
        () => (
          <>
            {([["injectionPosition", s.injectionPosition], ["injectionDepth", s.injectionDepth],
               ["injectionOrder", s.injectionOrder], ["forbidOverrides", String(s.forbidOverrides)],
               ["identifier", s.identifier]] as const).map(([k, v]) => (
              <div key={k} className="advrow"><span className="an t-data">{k}</span><span className="av t-data">{String(v)}</span></div>
            ))}
            {!readOnly && !marker && (
              <button className="dangerbtn" onClick={props.onDelete}>{t("presets.deleteSection")}</button>
            )}
            {marker && <p className="prose-note">{t("presets.markerUndeletable")}</p>}
          </>
        ))}

      {draft && !readOnly && <SectionSaveBar draft={draft} onSave={props.onSave} />}
    </div>
  );
}

/** Sticky commit bar for a section draft — mirrors the lorebook drawer's. */
function SectionSaveBar(props: { draft: Draft<PromptSection>; onSave: () => Promise<boolean> }) {
  const d = props.draft;
  if (d.conflict) {
    return (
      <div className="savebar has-conflict" role="alertdialog">
        <p className="t-label">Changed by someone else</p>
        <p className="prose-note">
          This section was updated elsewhere while you were editing
          {d.conflict.fields.length > 0 && <> — the same {d.conflict.fields.length === 1 ? "field" : "fields"} you changed ({d.conflict.fields.join(", ")})</>}
          . Saving now would overwrite that.
        </p>
        <div className="savebar-acts">
          <button className="dbtn" onClick={d.takeTheirs}>Discard mine, load theirs</button>
          <button className="dbtn is-primary" onClick={d.keepMine}>Re-apply mine over theirs</button>
        </div>
      </div>
    );
  }
  return (
    <div className={`savebar ${d.dirty ? "is-dirty" : ""}`}>
      <span className="savebar-state t-data">
        {d.saving ? "Saving…"
          : d.error ? <span className="is-err">{d.error}</span>
          : d.dirty ? <><b>{d.dirtyFields.length}</b> unsaved {d.dirtyFields.length === 1 ? "change" : "changes"}</>
          : "No changes"}
      </span>
      <div className="savebar-acts">
        <button className="dbtn" disabled={!d.dirty || d.saving} onClick={d.cancel}>Cancel</button>
        <button className="dbtn is-primary" disabled={!d.dirty || d.saving} onClick={() => void props.onSave()}>
          {d.saving ? "Saving…" : "Save changes"}
        </button>
      </div>
    </div>
  );
}
