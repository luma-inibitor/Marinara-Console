// Prompt preset browser + editor. Design decisions come from
// design/research/native-preset-editor-audit.md: data-bearing rows, one tap
// target, titles never truncate, autosave, reorder without drag, and a token
// meter the native editor lacks. Desktop = master-detail; mobile = accordion.
import { useCallback, useEffect, useMemo, useRef, useState } from "preact/hooks";
import { navigate } from "../../shell/router";
import { toast } from "../../shell/toast";
import { tokensOf } from "../../shell/api";
import { FullscreenText } from "../../ui/FullscreenText";
import {
  type PresetFull, type PromptPreset, type PromptSection,
  fetchPresets, fetchFull, patchPreset, patchSection, createSection, deleteSection,
  duplicatePreset, setDefaultPreset, deletePreset,
  orderedSections, presetLoad, sectionTokens,
} from "./data";

export function PresetsTool({ rest }: { rest: string[] }) {
  const id = rest[0];
  return id ? <Editor presetId={id} key={id} /> : <Browser />;
}

// ══ browser ══════════════════════════════════════════════════════
function Browser() {
  const [presets, setPresets] = useState<PromptPreset[] | null>(null);
  const [loads, setLoads] = useState<Record<string, { total: number; enabled: number; nSections: number }>>({});
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  const refresh = useCallback(() => {
    fetchPresets().then((list) => {
      setPresets(list);
      for (const p of list) {
        fetchFull(p.id).then((full) => {
          const load = presetLoad(full, "conversation");
          setLoads((s) => ({ ...s, [p.id]: { total: load.total, enabled: load.enabled, nSections: full.sections.length } }));
        }).catch(() => {});
      }
    }).catch((e: Error) => setError(e.message));
  }, []);
  useEffect(refresh, [refresh]);

  if (error) return <div class="screen"><div class="empty"><p class="t-label">Cannot reach engine</p><p class="t-data">{error}</p></div></div>;
  if (!presets) return <div class="screen"><div class="empty">Loading presets…</div></div>;

  const visible = presets.filter((p) =>
    !query.trim() || (p.name + " " + p.description + " " + p.author).toLowerCase().includes(query.toLowerCase()));

  return (
    <div class="screen">
      <div class="screen-head">
        <h1 class="screen-title">Presets</h1>
        <span class="meta"><span>{presets.length} presets</span></span>
      </div>
      <div class="pwrap" style="margin-bottom: var(--s2)">
        <input value={query} placeholder="Search presets…" aria-label="Search presets"
          onInput={(e) => setQuery(e.currentTarget.value)} />
      </div>
      {visible.map((p) => {
        const l = loads[p.id];
        return (
          <button key={p.id} class="card" onClick={() => navigate(`presets/${p.id}`)}>
            <div class="card-title">
              {p.name}
              {p.isDefault && <span class="tg" style="margin-left:8px">default</span>}
              {p.systemKey && <span class="tg is-none" style="margin-left:4px">stock</span>}
            </div>
            <div class="meta">
              <span><b class="t-num">{l?.nSections ?? "—"}</b> sections</span>
              <span><b class="t-num">{l?.enabled ?? "—"}</b> enabled</span>
              <span><b class="t-num">{(l?.total ?? 0).toLocaleString()}</b> tokens (est.)</span>
              <span>{p.wrapFormat}</span>
              {p.author && <span>by {p.author}</span>}
            </div>
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

function Editor({ presetId }: { presetId: string }) {
  const desktop = useIsDesktop();
  const [full, setFull] = useState<PresetFull | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<Set<string>>(new Set());
  const [focusId, setFocusId] = useState<string | null>(null);
  const [pill, setPill] = useState<"dirty" | "saved" | "err">("saved");
  const [fs, setFs] = useState<FsTarget | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  useEffect(() => {
    fetchFull(presetId).then(setFull).catch((e: Error) => setError(e.message));
  }, [presetId]);

  const readOnly = !!full?.preset.systemKey;
  const sections = useMemo(() => (full ? orderedSections(full) : []), [full]);
  const groupName = useCallback(
    (gid: string | null) => full?.groups.find((g) => g.id === gid)?.name ?? null,
    [full],
  );

  // ── saves (field-level, debounced, guarded when read-only) ──
  const guard = useCallback(() => {
    if (readOnly) { toast("This built-in preset is read-only. Duplicate it to edit.", { kind: "error" }); return true; }
    return false;
  }, [readOnly]);

  const saveSection = useCallback((sid: string, patch: Record<string, unknown>, immediate = false) => {
    if (guard()) return;
    setFull((f) => f && ({ ...f, sections: f.sections.map((s) => (s.id === sid ? { ...s, ...patch } as PromptSection : s)) }));
    setPill("dirty");
    clearTimeout(timers.current.get(sid));
    const run = async () => {
      timers.current.delete(sid);
      try { await patchSection(presetId, sid, patch); setPill("saved"); }
      catch (err) { setPill("err"); toast(`Failed to save section: ${(err as Error).message}`, { kind: "error" }); }
    };
    if (immediate) void run(); else timers.current.set(sid, setTimeout(run, 700));
  }, [presetId, guard]);

  const savePreset = useCallback((patch: Record<string, unknown>, immediate = false) => {
    if (guard()) return;
    setFull((f) => f && ({ ...f, preset: { ...f.preset, ...patch } as PromptPreset }));
    setPill("dirty");
    clearTimeout(timers.current.get("preset"));
    const run = async () => {
      timers.current.delete("preset");
      try { await patchPreset(presetId, patch); setPill("saved"); }
      catch (err) { setPill("err"); toast(`Failed to save preset: ${(err as Error).message}`, { kind: "error" }); }
    };
    if (immediate) void run(); else timers.current.set("preset", setTimeout(run, 700));
  }, [presetId, guard]);

  const move = useCallback((sid: string, delta: number) => {
    if (guard() || !full) return;
    const ids = orderedSections(full).map((s) => s.id);
    const i = ids.indexOf(sid);
    const j = i + delta;
    if (i < 0 || j < 0 || j >= ids.length) return;
    [ids[i], ids[j]] = [ids[j], ids[i]];
    setFull((f) => f && ({ ...f, preset: { ...f.preset, sectionOrder: JSON.stringify(ids) } }));
    patchPreset(presetId, { sectionOrder: ids }).catch((err: Error) =>
      toast(`Failed to reorder: ${err.message}`, { kind: "error" }));
  }, [full, presetId, guard]);

  const removeSection = useCallback((s: PromptSection) => {
    if (guard()) return;
    if (isDynamic(s)) { toast("Markers inject dynamic content and cannot be deleted here.", { kind: "error" }); return; }
    setFull((f) => f && ({ ...f, sections: f.sections.filter((x) => x.id !== s.id) }));
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
  }, [presetId, guard]);

  const addSection = useCallback(async () => {
    if (guard()) return;
    const name = prompt("Add Section", "New Section");
    if (!name?.trim()) return;
    try {
      const created = await createSection(presetId, {
        presetId, identifier: `custom_${Date.now().toString(36)}`, name: name.trim(), content: "",
      });
      setFull((f) => f && ({ ...f, sections: [...f.sections, created] }));
      setFocusId(created.id);
      setOpen((s) => new Set(s).add(created.id));
    } catch (err) { toast(`Failed to add section: ${(err as Error).message}`, { kind: "error" }); }
  }, [presetId, guard]);

  // ── keyboard: j/k over sections ──
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
    if (ev.key === "j" || ev.key === "ArrowDown") { ev.preventDefault(); moveFocus(1); }
    else if (ev.key === "k" || ev.key === "ArrowUp") { ev.preventDefault(); moveFocus(-1); }
    else if ((ev.key === "Enter" || ev.key === "o") && focusId && !desktop) {
      ev.preventDefault();
      setOpen((s) => { const n = new Set(s); n.has(focusId) ? n.delete(focusId) : n.add(focusId); return n; });
    } else if (ev.key === "Escape") navigate("presets");
  }, [sections, focusId, desktop]);

  if (error) return <div class="screen"><div class="empty"><p class="t-label">Could not load</p><p class="t-data">{error}</p></div></div>;
  if (!full) return <div class="screen"><div class="empty">Loading preset…</div></div>;

  const conv = presetLoad(full, "conversation");
  const game = presetLoad(full, "game");
  const focused = sections.find((s) => s.id === focusId) ?? null;

  const drawerFor = (s: PromptSection) => (
    <SectionDrawer
      section={s} readOnly={readOnly} groupName={groupName(s.groupId)} pill={pill}
      save={saveSection} onMove={move} onDelete={() => removeSection(s)}
      onExpand={() => setFs({ kind: "section", id: s.id })}
    />
  );

  return (
    <div class={`audit ${desktop ? "is-desktop" : ""}`}>
      <div class="audit-list" ref={listRef} onKeyDown={onListKey}>
        <header class="console">
          <div class="hrow">
            <button class="icon-btn" aria-label="Back to presets" onClick={() => navigate("presets")}>‹</button>
            <h1 class="console-title">{full.preset.name}</h1>
            {full.preset.isDefault && <span class="tg">default</span>}
            {readOnly && <span class="tg is-none">read-only</span>}
          </div>
          <div class="meter" title="Enabled sections + per-mode system prompt">
            <span class="t-label t-label-s">Prompt cost</span>
            <span class="mval t-data">
              <b>{conv.total.toLocaleString()}</b><span class="of"> conv</span>
              {" · "}
              <b>{game.total.toLocaleString()}</b><span class="of"> game</span>
              {" · "}
              <span class="of">{conv.enabled}/{sections.length} sections on</span>
            </span>
          </div>
          <div class="chiprail">
            <button class="chip" onClick={() => setFs({ kind: "preset", field: "conversationPrompt" })}>
              Conv prompt <b class="t-num">{tokensOf(full.preset.conversationPrompt)}</b>
            </button>
            <button class="chip" onClick={() => setFs({ kind: "preset", field: "gamePrompt" })}>
              Game prompt <b class="t-num">{tokensOf(full.preset.gamePrompt)}</b>
            </button>
            <button class="chip" onClick={() => setFs({ kind: "preset", field: "description" })}>Description</button>
            {(["xml", "markdown", "none"] as const).map((w) => (
              <button key={w} class="chip" aria-pressed={full.preset.wrapFormat === w}
                onClick={() => savePreset({ wrapFormat: w }, true)}>{w}</button>
            ))}
            <span class={`savepill is-${pill}`}>
              {pill === "dirty" ? "Autosaving…" : pill === "err" ? "Failed to save" : "Saved automatically"}
            </span>
          </div>
        </header>

        <main class="rows">
          {sections.map((s) => {
            const isOpen = !desktop && open.has(s.id);
            return (
              <article key={s.id}
                class={`row ${isOpen ? "is-open" : ""} ${focusId === s.id ? "is-focused" : ""}`}
                data-s={s.enabled ? "normal" : "disabled"}>
                <button class="row-summary" data-row={s.id} tabIndex={focusId === s.id ? 0 : -1}
                  aria-expanded={isOpen}
                  onClick={() => {
                    setFocusId(s.id);
                    if (!desktop) setOpen((o) => { const n = new Set(o); n.has(s.id) ? n.delete(s.id) : n.add(s.id); return n; });
                  }}>
                  <span class="rail-cell"><span class="dot" /></span>
                  <span class="mid">
                    <span class="nm">{s.name}</span>
                    <span class="metaline">
                      {isDynamic(s) && <span class="tg">marker</span>}
                      {groupName(s.groupId) && <span class="tg">{groupName(s.groupId)}</span>}
                      <span class="keys t-data">{s.role}{s.injectionPosition !== "ordered" ? ` · ${s.injectionPosition} ${s.injectionDepth}` : ""}</span>
                    </span>
                  </span>
                  <span class="num">
                    <b class="tok t-num">{sectionTokens(s)}</b><span class="unit t-data">tokens</span>
                  </span>
                </button>
                {isOpen && drawerFor(s)}
              </article>
            );
          })}
        </main>

        <nav class="dock-actions">
          <button class="dbtn" onClick={() => { void duplicatePreset(presetId).then((p) => navigate(`presets/${p.id}`)); }}>⧉ Duplicate</button>
          {!full.preset.isDefault && (
            <button class="dbtn" onClick={() => { void setDefaultPreset(presetId).then(() => fetchFull(presetId).then(setFull)); }}>★ Set default</button>
          )}
          {!readOnly && <button class="dbtn is-primary" onClick={addSection}>＋ Add Section</button>}
          {readOnly && <button class="dbtn is-primary" onClick={() => { void duplicatePreset(presetId).then((p) => navigate(`presets/${p.id}`)); }}>⧉ Editable copy</button>}
        </nav>
      </div>

      {desktop && (
        <aside class="audit-detail">
          {focused ? drawerFor(focused) : (
            <div class="empty">Select a section — <span class="t-data">j/k</span> to move, edits save automatically.</div>
          )}
        </aside>
      )}

      {fs && (() => {
        if (fs.kind === "section") {
          const s = sections.find((x) => x.id === fs.id);
          return s ? (
            <FullscreenText title="Edit Content" subtitle={s.name} initial={s.content}
              onDone={(v) => { saveSection(s.id, { content: v }, true); setFs(null); }} />
          ) : null;
        }
        const titles = { conversationPrompt: "Conversation Prompt", gamePrompt: "Game Prompt", description: "Description" } as const;
        return (
          <FullscreenText title={titles[fs.field]} subtitle={full.preset.name}
            initial={String(full.preset[fs.field] ?? "")}
            onDone={(v) => { savePreset({ [fs.field]: v }, true); setFs(null); }} />
        );
      })()}
    </div>
  );
}

// A "dynamic" section is a marker whose content is injected at runtime (empty
// here). Content-bearing sections are editable even when the engine flags them
// isMarker (every template-defined section is).
const isDynamic = (s: PromptSection) => s.isMarker && s.content.length === 0;

// ── section drawer (drawer on mobile, detail pane on desktop) ──
function SectionDrawer(props: {
  section: PromptSection;
  readOnly: boolean;
  groupName: string | null;
  pill: "dirty" | "saved" | "err";
  save: (id: string, patch: Record<string, unknown>, immediate?: boolean) => void;
  onMove: (id: string, delta: number) => void;
  onDelete: () => void;
  onExpand: () => void;
}) {
  const { section: s, save } = props;
  return (
    <div class="drawer" data-s={s.enabled ? "normal" : "disabled"}>
      <div class="sub is-open">
        <div class="sub-head"><span class="t-label t-label-s">Section</span>
          <span class="sub-summary t-data">{s.identifier}</span><span /></div>
        <div class="sub-body">
          <input class="tin" value={s.name} disabled={props.readOnly}
            onInput={(ev) => save(s.id, { name: ev.currentTarget.value })}
            onBlur={(ev) => save(s.id, { name: ev.currentTarget.value }, true)} />
          <div class="seg4" style="margin-top: var(--s2)">
            <button class="segbtn" data-v={s.enabled ? "normal" : "disabled"} aria-pressed={s.enabled}
              onClick={() => save(s.id, { enabled: !s.enabled }, true)}>
              <span class="d" />{s.enabled ? "Enabled" : "Disabled"}
            </button>
            {(["system", "user", "assistant"] as const).map((r) => (
              <button key={r} class="segbtn is-pos t-data" aria-pressed={s.role === r} disabled={props.readOnly}
                onClick={() => save(s.id, { role: r }, true)}>{r}</button>
            ))}
          </div>
          <div class="movebar" style="margin-top: var(--s2)">
            <button aria-label="Move up" onClick={() => props.onMove(s.id, -1)}>↑</button>
            <span class="slot"><span class="v t-num">{sectionTokens(s)}t</span>
              <span class="c t-data">{isDynamic(s) ? "marker — content injected at runtime" : `${s.content.length} ch`}</span></span>
            <button aria-label="Move down" onClick={() => props.onMove(s.id, 1)}>↓</button>
          </div>
        </div>
      </div>

      {!isDynamic(s) && (
        <div class="sub is-open">
          <div class="sub-head"><span class="t-label t-label-s">Content</span>
            <span class="sub-summary t-data"><b>{s.content.length}</b> ch · <b>{sectionTokens(s)}</b> tokens</span><span /></div>
          <div class="sub-body">
            <div class="fieldbar"><button class="chip" onClick={props.onExpand}>⤢ Edit Content</button></div>
            <textarea class="ta is-mono" rows={8} value={s.content} disabled={props.readOnly}
              onInput={(ev) => save(s.id, { content: ev.currentTarget.value })}
              onBlur={(ev) => save(s.id, { content: ev.currentTarget.value }, true)} />
          </div>
        </div>
      )}

      <div class="sub is-open">
        <div class="sub-head"><span class="t-label t-label-s">Advanced</span>
          <span class="sub-summary t-data">
            <span class={`savepill is-${props.pill}`}>
              {props.pill === "dirty" ? "Autosaving…" : props.pill === "err" ? "Failed to save" : "Saved automatically"}
            </span>
          </span><span /></div>
        <div class="sub-body">
          {([["injectionPosition", s.injectionPosition], ["injectionDepth", s.injectionDepth],
             ["injectionOrder", s.injectionOrder], ["forbidOverrides", s.forbidOverrides],
             ["group", props.groupName ?? "—"], ["identifier", s.identifier]] as const).map(([k, v]) => (
            <div key={k} class="advrow"><span class="an t-data">{k}</span><span class="av t-data">{String(v)}</span></div>
          ))}
          {!props.readOnly && !isDynamic(s) && (
            <button class="dangerbtn" onClick={props.onDelete}>Delete section</button>
          )}
        </div>
      </div>
    </div>
  );
}
