// Prompt preset browser + editor.
//
// Design comes from design/research/native-preset-editor-audit.md plus a
// four-lens critique of the first implementation. Key corrections carried here:
// real collapsible sub-accordions (not hardcoded-open), ordinal-bearing status
// rail (order is THE attribute of a prompt preset), enabled/role split into two
// controls, save state always visible, titles wrap, markers labelled by type
// rather than shown as "0 tokens", and optimistic writes that roll back.
import { useCallback, useEffect, useMemo, useRef, useState } from "preact/hooks";
import type { ComponentChildren } from "preact";
import { navigate } from "../../shell/router";
import { toast } from "../../shell/toast";
import { tokensOf } from "../../shell/api";
import { FullscreenText } from "../../ui/FullscreenText";
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

// ══ browser ══════════════════════════════════════════════════════
type BrowserSort = "tokens" | "sections" | "name";

function Browser() {
  const [presets, setPresets] = useState<PromptPreset[] | null>(null);
  const [loads, setLoads] = useState<Record<string, PresetLoad | "error">>({});
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<BrowserSort>("tokens");

  useEffect(() => {
    fetchPresets().then((list) => {
      setPresets(list);
      for (const p of list) {
        fetchFull(p.id)
          .then((full) => setLoads((s) => ({ ...s, [p.id]: presetLoad(full, "conversation") })))
          .catch(() => setLoads((s) => ({ ...s, [p.id]: "error" })));
      }
    }).catch((e: Error) => setError(e.message));
  }, []);

  if (error) return <div class="screen"><div class="empty"><p class="t-label">Cannot reach engine</p><p>{error}</p></div></div>;
  if (!presets) return <div class="screen"><div class="empty">Loading presets…</div></div>;

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
    <div class="screen is-narrow">
      <div class="screen-head">
        <h1 class="screen-title">Presets</h1>
        <span class="meta">
          <span>{presets.length === 1 ? "1 preset" : `${presets.length} presets`}</span>
          {grand > 0 && <span><b class="t-num">{grand.toLocaleString()}</b> tokens total</span>}
        </span>
      </div>

      <div class="probe">
        <div class="pwrap">
          <input value={query} placeholder="Search presets…" aria-label="Search presets"
            onInput={(e) => setQuery(e.currentTarget.value)} />
          {query.trim() !== "" && <span class="res">{visible.length} match</span>}
        </div>
      </div>
      <div class="chiprail">
        {(["tokens", "sections", "name"] as BrowserSort[]).map((k) => (
          <button key={k} class="chip" aria-pressed={sort === k} onClick={() => setSort(k)}>
            {{ tokens: "Tokens", sections: "Sections", name: "Name" }[k]}
            {sort === k && <span class="ar"> ↓</span>}
          </button>
        ))}
      </div>

      {visible.map((p) => {
        const l = loads[p.id];
        const known = l && l !== "error" ? l : null;
        const maxSeen = Math.max(...Object.values(loads).map((x) => (x && x !== "error" ? x.total : 0)), 1);
        return (
          <button key={p.id} class="card preset-card" onClick={() => navigate(`presets/${p.id}`)}>
            <div class="preset-card-main">
              <div class="card-title">
                {p.name}
                {p.isDefault && <span class="tg is-default">default</span>}
                {p.systemKey && <span class="tg">stock</span>}
                <span class="tg">{p.wrapFormat}</span>
              </div>
              {p.description
                ? <p class="preset-desc">{p.description}</p>
                : <p class="preset-desc is-empty">No description</p>}
              <div class="meta">
                <span><b class="t-num">{known ? known.totalSections : "—"}</b> sections</span>
                {known && known.enabled !== known.totalSections && (
                  <span><b class="t-num" style="color: var(--text-dim)">{known.totalSections - known.enabled}</b> off</span>
                )}
                {known && known.markers > 0 && <span><b class="t-num">{known.markers}</b> runtime</span>}
                {l === "error" && <span style="color: var(--danger)">could not load detail</span>}
              </div>
            </div>
            <div class="preset-card-gutter">
              <b class="tok t-num">{known ? known.total.toLocaleString() : "—"}</b>
              <span class="unit t-data">tokens</span>
            </div>
            {known && <div class="bar"><i style={`width:${(known.total / maxSeen) * 100}%`} /></div>}
          </button>
        );
      })}
      {visible.length === 0 && <p class="empty">No presets match your search</p>}
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
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<Set<string>>(new Set());
  const [focusId, setFocusId] = useState<string | null>(null);
  const [pill, setPill] = useState<Pill>("saved");
  const [fs, setFs] = useState<FsTarget | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  useEffect(() => {
    fetchFull(presetId).then((f) => {
      setFull(f);
      // Desktop detail pane is never usefully empty — select the first section.
      if (window.matchMedia("(min-width: 900px)").matches) {
        setFocusId(orderedSections(f)[0]?.id ?? null);
      }
    }).catch((e: Error) => setError(e.message));
  }, [presetId]);

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
    if (readOnly) { toast("This built-in preset is read-only. Duplicate it to edit.", { kind: "error" }); return true; }
    return false;
  }, [readOnly]);

  // ── optimistic writes WITH rollback ──
  const saveSection = useCallback((sid: string, patch: Record<string, unknown>, immediate = false) => {
    if (guard()) return;
    let before: PromptSection | undefined;
    setFull((f) => {
      if (!f) return f;
      before = f.sections.find((s) => s.id === sid);
      return { ...f, sections: f.sections.map((s) => (s.id === sid ? { ...s, ...patch } as PromptSection : s)) };
    });
    setPill("dirty");
    clearTimeout(timers.current.get(sid));
    const run = async () => {
      timers.current.delete(sid);
      try { await patchSection(presetId, sid, patch); setPill("saved"); }
      catch (err) {
        setPill("err");
        if (before) setFull((f) => f && ({ ...f, sections: f.sections.map((s) => (s.id === sid ? before! : s)) }));
        toast(`Reverted — could not save section: ${(err as Error).message}`, { kind: "error" });
      }
    };
    if (immediate) void run(); else timers.current.set(sid, setTimeout(run, 700));
  }, [presetId, guard]);

  const savePreset = useCallback((patch: Record<string, unknown>, immediate = false) => {
    if (guard()) return;
    let before: PromptPreset | undefined;
    setFull((f) => { if (!f) return f; before = f.preset; return { ...f, preset: { ...f.preset, ...patch } as PromptPreset }; });
    setPill("dirty");
    clearTimeout(timers.current.get("preset"));
    const run = async () => {
      timers.current.delete("preset");
      try { await patchPreset(presetId, patch); setPill("saved"); }
      catch (err) {
        setPill("err");
        if (before) setFull((f) => f && ({ ...f, preset: before! }));
        toast(`Reverted — could not save preset: ${(err as Error).message}`, { kind: "error" });
      }
    };
    if (immediate) void run(); else timers.current.set("preset", setTimeout(run, 700));
  }, [presetId, guard]);

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
        toast(`Reverted — could not reorder: ${err.message}`, { kind: "error" });
      });
  }, [full, presetId, guard]);

  const removeSection = useCallback((s: PromptSection) => {
    if (guard()) return;
    if (isMarker(s)) { toast("Markers inject content at runtime and cannot be deleted.", { kind: "error" }); return; }
    setFull((f) => f && ({ ...f, sections: f.sections.filter((x) => x.id !== s.id) }));
    if (focusId === s.id) setFocusId(null);
    toast(`Deleted "${s.name}".`, {
      actionLabel: "Undo",
      onAction: () => setFull((f) => f && ({ ...f, sections: [...f.sections, s] })),
      onExpire: () => {
        deleteSection(presetId, s.id).catch((err: Error) => {
          toast(`Delete failed: ${err.message}`, { kind: "error" });
          setFull((f) => f && ({ ...f, sections: [...f.sections, s] }));
        });
      },
    });
  }, [presetId, guard, focusId]);

  /** Create inline and focus the name field — no native prompt(). */
  const addSection = useCallback(async () => {
    if (guard()) return;
    try {
      const created = await createSection(presetId, {
        presetId, identifier: `custom_${Date.now().toString(36)}`, name: "New Section", content: "",
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
    } catch (err) { toast(`Failed to add section: ${(err as Error).message}`, { kind: "error" }); }
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

  const onListKey = useCallback((ev: KeyboardEvent) => {
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

  if (error) return <div class="screen"><div class="empty"><p class="t-label">Could not load</p><p>{error}</p></div></div>;
  if (!full) return <div class="screen"><div class="empty">Loading preset…</div></div>;

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
      save={saveSection} onMove={move} onDelete={() => removeSection(s)}
      onExpand={() => setFs({ kind: "section", id: s.id })}
    />
  );

  const dockButtons = [
    <button key="dup" class="dbtn" onClick={() => { void duplicatePreset(presetId).then((p) => navigate(`presets/${p.id}`)); }}>⧉ Duplicate</button>,
    !full.preset.isDefault && (
      <button key="def" class="dbtn" onClick={() => {
        void setDefaultPreset(presetId)
          .then(() => fetchFull(presetId).then(setFull))
          .catch((e: Error) => toast(`Could not set default: ${e.message}`, { kind: "error" }));
      }}>★ Set default</button>
    ),
    readOnly
      ? <button key="copy" class="dbtn is-primary" onClick={() => { void duplicatePreset(presetId).then((p) => navigate(`presets/${p.id}`)); }}>⧉ Editable copy</button>
      : <button key="add" class="dbtn is-primary" onClick={addSection}>＋ Add Section</button>,
  ].filter(Boolean) as ComponentChildren[];

  return (
    <div class={`audit ${desktop ? "is-desktop" : ""}`}>
      <div class="audit-list" ref={listRef} onKeyDown={onListKey}>
        <header class="console">
          <div class="hrow">
            <button class="icon-btn" aria-label="Back to presets" onClick={() => navigate("presets")}>‹</button>
            <h1 class="console-title is-wrapping">{full.preset.name}</h1>
            <span class={`savepill is-${pill}`}>
              {pill === "dirty" ? "Autosaving…" : pill === "err" ? "Save failed" : "Saved"}
            </span>
          </div>
          <div class="tagline">
            {full.preset.isDefault && <span class="tg is-default">default</span>}
            {readOnly && <span class="tg">read-only</span>}
            <span class="meta">
              <span><b class="t-num">{conv.total.toLocaleString()}</b> conv</span>
              <span><b class="t-num">{game.total.toLocaleString()}</b> game</span>
              <span>{conv.enabled}/{conv.totalSections} on</span>
              {conv.markers > 0 && <span>+{conv.markers} runtime</span>}
            </span>
          </div>
          {budget > 0 && (
            <div class="meter">
              <span class="t-label t-label-s">of context</span>
              <span class="mbar">
                <span class="m-k" style={`width:${Math.min(100, (conv.total / budget) * 100)}%`} />
              </span>
              <span class="mval t-data"><b>{Math.round((conv.total / budget) * 100)}%</b><span class="of"> of {budget.toLocaleString()}</span></span>
            </div>
          )}
          <p class="costnote t-data">Template only — excludes characters, personas, lorebooks and history.</p>

          <div class="segrow" role="group" aria-label="Wrap format">
            {(["xml", "markdown", "none"] as const).map((w) => (
              <button key={w} class="segbtn is-pos t-data" aria-pressed={full.preset.wrapFormat === w}
                disabled={readOnly} onClick={() => savePreset({ wrapFormat: w }, true)}>{w}</button>
            ))}
          </div>
          <div class="chiprail">
            <button class="chip" onClick={() => setFs({ kind: "preset", field: "conversationPrompt" })}>
              Conv prompt <b class="t-num">{tokensOf(expand(full.preset.conversationPrompt, full.preset))}</b>
            </button>
            <button class="chip" onClick={() => setFs({ kind: "preset", field: "gamePrompt" })}>
              Game prompt <b class="t-num">{tokensOf(expand(full.preset.gamePrompt, full.preset))}</b>
            </button>
            <button class="chip" onClick={() => setFs({ kind: "preset", field: "description" })}>Description</button>
          </div>
        </header>

        <main class="rows">
          {sections.length === 0 && (
            <p class="empty">No sections yet. Add one to start building the prompt.</p>
          )}
          {sections.map((s, i) => {
            const isOpen = !desktop && open.has(s.id);
            const on = effectivelyEnabled(s, full.groups);
            const marker = isMarker(s);
            const tok = sectionTokens(s, full.preset);
            const run = runs.get(s.id);
            return (
              <article key={s.id}
                class={`row ${isOpen ? "is-open" : ""} ${focusId === s.id ? "is-focused" : ""} ${run ? `in-group is-${run}` : ""}`}
                data-s={on ? "normal" : "disabled"}>
                <button class="row-summary" data-row={s.id} tabIndex={focusId === s.id ? 0 : -1}
                  aria-expanded={isOpen} onClick={() => openRow(s)}>
                  <span class="rail-cell">
                    <span class="ord t-num">{i + 1}</span>
                    {!on && <span class="off-mark" aria-hidden="true" />}
                  </span>
                  <span class="mid">
                    <span class="nm">{s.name}</span>
                    <span class="metaline">
                      {marker && <span class="tg is-marker">{markerLabel(s)}</span>}
                      {groupName(s.groupId) && (
                        <span class={`tg ${groupOff(s.groupId) ? "is-off" : ""}`}>
                          {groupName(s.groupId)}{groupOff(s.groupId) ? " off" : ""}
                        </span>
                      )}
                      {!on && <span class="tg is-off">disabled</span>}
                      {s.injectionPosition !== "ordered" && (
                        <span class="keys t-data">{s.injectionPosition} {s.injectionDepth}</span>
                      )}
                    </span>
                  </span>
                  <span class="num">
                    {marker
                      ? <span class="tok-runtime t-data">runtime</span>
                      : <><b class={`tok t-num ${tok > tokenP90 && tokenP90 > 0 ? "is-hot" : ""}`}>{tok}</b>
                         <span class="unit t-data">tokens</span></>}
                  </span>
                </button>
                {isOpen && detailFor(s)}
              </article>
            );
          })}
        </main>

        <nav class="dock-actions" style={`grid-template-columns: repeat(${dockButtons.length}, 1fr)`}>
          {dockButtons}
        </nav>
      </div>

      {desktop && (
        <aside class="audit-detail">
          {focused ? detailFor(focused) : (
            <div class="empty">
              <p class="t-label" style="margin-bottom:8px">No sections</p>
              <p>Add a section to start building this prompt.</p>
            </div>
          )}
        </aside>
      )}

      {fs && (() => {
        if (fs.kind === "section") {
          const s = sections.find((x) => x.id === fs.id);
          return s ? (
            <FullscreenText title="Edit Content" subtitle={s.name} initial={s.content}
              budget={budget || undefined}
              onDone={(v) => { saveSection(s.id, { content: v }, true); setFs(null); }} />
          ) : null;
        }
        const titles = { conversationPrompt: "Conversation Prompt", gamePrompt: "Game Prompt", description: "Description" } as const;
        return (
          <FullscreenText title={titles[fs.field]} subtitle={full.preset.name}
            initial={String(full.preset[fs.field] ?? "")} budget={budget || undefined}
            onDone={(v) => { savePreset({ [fs.field]: v }, true); setFs(null); }} />
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
  save: (id: string, patch: Record<string, unknown>, immediate?: boolean) => void;
  onMove: (id: string, delta: number, to?: number) => void;
  onDelete: () => void;
  onExpand: () => void;
}) {
  const { section: s, save, readOnly } = props;
  const marker = isMarker(s);
  const [openSubs, setOpenSubs] = useState<Set<Sub>>(
    () => new Set<Sub>(marker ? ["section"] : ["section", "content"]));
  const toggle = (id: Sub) => setOpenSubs((p) => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const tok = sectionTokens(s, props.preset);
  const expanded = expand(s.content, props.preset);
  const macroDelta = expanded.length - s.content.length;

  const sub = (id: Sub, label: string, summary: ComponentChildren, body: () => ComponentChildren) => {
    const isOpen = openSubs.has(id);
    return (
      <div class={`sub ${isOpen ? "is-open" : ""}`}>
        <button class="sub-head" aria-expanded={isOpen} onClick={() => toggle(id)}>
          <span class="t-label t-label-s">{label}</span>
          <span class="sub-summary t-data">{summary}</span>
          <span class="caret" aria-hidden="true">{isOpen ? "▴" : "▾"}</span>
        </button>
        {isOpen && <div class="sub-body">{body()}</div>}
      </div>
    );
  };

  const advNonDefault = [
    s.injectionPosition !== "ordered" && `${s.injectionPosition} ${s.injectionDepth}`,
    s.injectionOrder !== 100 && s.injectionOrder !== 0 && `order ${s.injectionOrder}`,
    s.forbidOverrides && "no overrides",
    props.groupName && `group ${props.groupName}${props.groupOff ? " (off)" : ""}`,
  ].filter(Boolean) as string[];

  return (
    <div class="drawer">
      {sub("section", "Section",
        <><span class={s.enabled ? "is-on" : "is-off"}>{s.enabled ? "on" : "off"}</span> · {s.role} · {props.index + 1}/{props.total}</>,
        () => (
          <>
            <input class="tin" value={s.name} placeholder="Section name" disabled={readOnly}
              data-name-input={s.id}
              onInput={(ev) => save(s.id, { name: ev.currentTarget.value })}
              onBlur={(ev) => save(s.id, { name: ev.currentTarget.value }, true)} />

            <div class="field">
              <span class="t-label t-label-s">Included</span>
              <button class="toggle" role="switch" aria-checked={s.enabled} disabled={readOnly}
                onClick={() => save(s.id, { enabled: !s.enabled }, true)}>
                <span class="toggle-track"><span class="toggle-thumb" /></span>
                <span class="toggle-label">{s.enabled ? "Enabled" : "Disabled"}</span>
              </button>
              {props.groupOff && (
                <p class="hint t-data">Group “{props.groupName}” is disabled — this section will not be injected regardless.</p>
              )}
            </div>

            <div class="field">
              <span class="t-label t-label-s">Role</span>
              <div class="segrow is-3">
                {(["system", "user", "assistant"] as const).map((r) => (
                  <button key={r} class="segbtn is-pos t-data" aria-pressed={s.role === r} disabled={readOnly}
                    onClick={() => save(s.id, { role: r }, true)}>{r}</button>
                ))}
              </div>
            </div>

            <div class="field">
              <span class="t-label t-label-s">Position</span>
              <div class="movebar">
                <button class="movebtn" disabled={readOnly || props.index === 0}
                  onClick={() => props.onMove(s.id, -1)}>↑ <span class="t-label t-label-s">up</span></button>
                <span class="slot">
                  <span class="v t-num">{props.index + 1}</span>
                  <span class="c t-data">of {props.total}</span>
                </span>
                <button class="movebtn" disabled={readOnly || props.index === props.total - 1}
                  onClick={() => props.onMove(s.id, 1)}>↓ <span class="t-label t-label-s">down</span></button>
              </div>
              {props.desktop && <p class="hint t-data">Shift+J / Shift+K reorders from the list.</p>}
            </div>
          </>
        ))}

      {marker
        ? sub("content", "Content", <span class="is-runtime">injected at runtime</span>, () => (
            <p class="prose-note">
              This is a <b>{markerLabel(s)}</b> marker. The engine replaces it at generation time with live
              {" "}{markerLabel(s)?.toLowerCase()} content, so it has no fixed token cost here.
            </p>
          ))
        : sub("content", "Content",
            <><b>{(macroDelta > 0 ? expanded.length : s.content.length).toLocaleString()}</b> ch · <b>{tok}</b> tokens{macroDelta > 0 ? " (expanded)" : ""}</>,
            () => (
              <>
                <button class="edit-content" onClick={props.onExpand}>
                  <span class="ec-label t-label t-label-s">⤢ Edit in full screen</span>
                  <span class="ec-meta t-data">{s.content.length.toLocaleString()} ch raw</span>
                </button>
                {props.desktop && (
                  <textarea class="ta is-mono is-fill" value={s.content} disabled={readOnly}
                    onInput={(ev) => save(s.id, { content: ev.currentTarget.value })}
                    onBlur={(ev) => save(s.id, { content: ev.currentTarget.value }, true)} />
                )}
                {!props.desktop && s.content && (
                  <p class="content-preview t-data">{s.content.slice(0, 160)}{s.content.length > 160 ? "…" : ""}</p>
                )}
                {macroDelta > 0 && (
                  <p class="hint t-data">
                    Macros expand to {expanded.length.toLocaleString()} ch (+{macroDelta.toLocaleString()}) — token count reflects the expansion.
                  </p>
                )}
              </>
            ))}

      {sub("advanced", "Advanced",
        advNonDefault.length ? <>{advNonDefault.length} set</> : "all default",
        () => (
          <>
            {([["injectionPosition", s.injectionPosition], ["injectionDepth", s.injectionDepth],
               ["injectionOrder", s.injectionOrder], ["forbidOverrides", String(s.forbidOverrides)],
               ["identifier", s.identifier]] as const).map(([k, v]) => (
              <div key={k} class="advrow"><span class="an t-data">{k}</span><span class="av t-data">{String(v)}</span></div>
            ))}
            {!readOnly && !marker && (
              <button class="dangerbtn" onClick={props.onDelete}>Delete section</button>
            )}
            {marker && <p class="hint t-data">Markers cannot be deleted — remove the feature upstream instead.</p>}
          </>
        ))}
    </div>
  );
}
