// Memory Vault — browse and correct what is stored (ltm-review J4).
// Source notes are audit records, not memories: excluded by default, behind a
// toggle. Cap pressure reads as a gradient on the row. Archive is the
// destructive default (undoable); permanent delete confirms.

import { useEffect, useMemo, useState } from "preact/hooks";
import { openOverlay, closeTopOverlay } from "./overlays";
import { toast } from "../../shell/toast";
import {
  type Note, type NoteType, fetchNotes, patchNote, deleteNote,
  SECTION_CAP, KEYWORD_CAP,
} from "./data";
import { t } from "./strings";
import { dedupeLines } from "./derived";
import { NoteRef } from "./NotePeek";

type SortKey = "updated" | "title" | "pressure" | "status";

function pressureOf(n: Note): number {
  let worst = 0;
  for (const s of Object.values(n.sections ?? {})) {
    worst = Math.max(worst, (s.text?.length ?? 0) / SECTION_CAP);
  }
  return Math.max(worst, (n.keywords?.length ?? 0) / KEYWORD_CAP);
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

export function Vault() {
  const desktop = useIsDesktop();
  const [notes, setNotes] = useState<Note[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [showSources, setShowSources] = useState(false);
  const [typeFilter, setTypeFilter] = useState<NoteType | null>(null);
  const [sort, setSort] = useState<SortKey>("updated");
  const [openId, setOpenId] = useState<string | null>(null);

  const load = () => fetchNotes({ limit: 500 }).then(setNotes).catch((e: Error) => setError(e.message));
  useEffect(() => { void load(); }, []);

  const visible = useMemo(() => {
    let list = (notes ?? []).filter((n) => (showSources ? n.type === "source" : n.type !== "source"));
    if (typeFilter) list = list.filter((n) => n.type === typeFilter);
    if (query.trim()) {
      const q = query.toLowerCase();
      list = list.filter((n) =>
        (n.title ?? n.id).toLowerCase().includes(q) ||
        Object.values(n.sections ?? {}).some((s) => s.text?.toLowerCase().includes(q)));
    }
    const statusRank: Record<string, number> = { active: 0, resolved: 1, archived: 2 };
    const cmp: Record<SortKey, (a: Note, b: Note) => number> = {
      updated: (a, b) => String(b.updatedAt ?? "").localeCompare(String(a.updatedAt ?? "")),
      title: (a, b) => (a.title ?? a.id).localeCompare(b.title ?? b.id),
      pressure: (a, b) => pressureOf(b) - pressureOf(a),
      status: (a, b) => (statusRank[a.status] ?? 9) - (statusRank[b.status] ?? 9),
    };
    return [...list].sort(cmp[sort]);
  }, [notes, showSources, typeFilter, query, sort]);

  const types = useMemo(() => {
    const m = new Map<NoteType, number>();
    for (const n of notes ?? []) {
      if (n.type === "source") continue;
      m.set(n.type, (m.get(n.type) ?? 0) + 1);
    }
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [notes]);

  if (error) return <div class="screen"><div class="empty"><p class="t-label">Could not load</p><p class="t-data">{error}</p></div></div>;
  if (!notes) return <div class="screen"><div class="empty">{t("memoryvault.loadingMemories")}</div></div>;

  const stackOpen = !desktop && Boolean(openId);
  useEffect(() => {
    if (stackOpen) openOverlay(() => setOpenId(null));
  }, [stackOpen]);

  const memoriesN = notes.filter((n) => n.type !== "source").length;
  const sourcesN = notes.length - memoriesN;
  const open = openId ? notes.find((n) => n.id === openId) ?? null : null;

  return (
    <div class={`audit ${desktop ? "is-desktop" : ""}`}>
      <div class="audit-list">
        <header class="console">
          <div class="probe">
            <div class="pwrap">
              <input value={query} placeholder={t("memoryvault.searchMemories")}
                aria-label={t("memoryvault.searchMemories")}
                onInput={(e) => setQuery(e.currentTarget.value)} />
              {query.trim() !== "" && <span class="res">{visible.length} match</span>}
            </div>
          </div>
          <div class="chiprail">
            <button class="chip" aria-pressed={!showSources} onClick={() => setShowSources(false)}>
              Memories <b class="t-num">{memoriesN}</b>
            </button>
            <button class="chip" aria-pressed={showSources} onClick={() => setShowSources(true)}>
              {t("memoryvault.sources")} <b class="t-num">{sourcesN}</b>
            </button>
            <span class="rail-gap" />
            {types.map(([type, n]) => (
              <button key={type} class="chip" aria-pressed={typeFilter === type}
                onClick={() => setTypeFilter(typeFilter === type ? null : type)}>
                <span class={`tdot type-${type}`} aria-hidden="true" />{type.replaceAll("_", " ")} {n}
              </button>
            ))}
            <span class="rail-gap" />
            {(["updated", "title", "pressure", "status"] as SortKey[]).map((k) => (
              <button key={k} class="chip" aria-pressed={sort === k} onClick={() => setSort(k)}>
                ↓ {{ updated: "Edited", title: "Title", pressure: "Limits", status: "Status" }[k]}
              </button>
            ))}
          </div>
        </header>
        <main class="rows mem-rows">
          {visible.length === 0 && <p class="empty">{t("memoryvault.noSavedMemoriesYetImportASourceOrCreate")}</p>}
          {visible.map((n) => <NoteRow key={n.id} note={n} isOpen={openId === n.id} onOpen={() => setOpenId(n.id)} />)}
        </main>
      </div>
      {desktop && (
        <aside class="audit-detail">
          {open
            ? <NoteEditor note={open} onChanged={load} onClose={() => setOpenId(null)} />
            : <div class="empty"><p class="t-label t-label-s">No note open</p><p class="t-prose">Select a memory to edit it.</p></div>}
        </aside>
      )}
      {!desktop && open && (
        <div class="stack-screen">
          <header class="console"><div class="hrow">
            <button class="icon-btn hit" aria-label="Back to vault" onClick={closeTopOverlay}>‹</button>
            <h1 class="console-title">{open.title ?? open.id}</h1>
          </div></header>
          <NoteEditor note={open} onChanged={load} onClose={() => setOpenId(null)} />
        </div>
      )}
    </div>
  );
}

function NoteRow(props: { note: Note; isOpen: boolean; onOpen: () => void }) {
  const n = props.note;
  const p = pressureOf(n);
  const chars = Object.values(n.sections ?? {}).reduce((sum, s) => sum + (s.text?.length ?? 0), 0);
  return (
    <div class={`row mem-row ${props.isOpen ? "is-open" : ""}`}>
      <button class="row-summary vault-summary" onClick={props.onOpen}>
        <span class="rail-cell"><span class={`tdot type-${n.type}`} aria-hidden="true" /></span>
        <span class="mid">
          <span class="nm">{n.title ?? n.id}</span>
          <span class="metaline t-data">
            <span class={`chip-min type-${n.type}`}>{n.type.replaceAll("_", " ")}</span>
            {n.status !== "active" && <><i class="sep" data-contrast-exempt>·</i>{n.status}</>}
            <i class="sep" data-contrast-exempt>·</i><span class="dim">{(n.modes ?? []).join(" ")}</span>
            {p >= 0.8 && <><i class="sep" data-contrast-exempt>·</i><span class="fl">{p >= 1 ? "over the limit" : "near a limit"}</span></>}
          </span>
          {p >= 0.5 && (
            <span class="pbar"><i class={p >= 1 ? "is-over" : p >= 0.8 ? "is-near" : ""} style={`width:${Math.min(p * 100, 100)}%`} /></span>
          )}
        </span>
        <span class="num">
          <span class={`tok ${p >= 0.8 ? "is-hot" : ""}`}>{(chars / 1000).toFixed(1)}k</span>
          <span class="unit">ch</span>
        </span>
      </button>
    </div>
  );
}

function NoteEditor(props: { note: Note; onChanged: () => Promise<void> | void; onClose: () => void }) {
  const n = props.note;
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [status, setStatus] = useState(n.status);
  const [busy, setBusy] = useState(false);

  // One tap changes status immediately (optimistic; low-risk + recoverable).
  const changeStatus = (next: Note["status"]) => {
    if (next === status) return;
    const previous = status;
    setStatus(next);
    patchNote(n.id, { status: next })
      .then(() => props.onChanged())
      .catch((e: Error) => { setStatus(previous); toast(e.message, { kind: "error" }); });
  };

  const save = async () => {
    const patch: Record<string, unknown> = {};
    const sections: Record<string, unknown> = {};
    for (const [key, s] of Object.entries(n.sections ?? {})) {
      const v = drafts[key];
      if (v !== undefined && v !== s.text) sections[key] = { ...s, text: v };
    }
    if (Object.keys(sections).length) patch.sections = { ...n.sections, ...sections };
    if (!Object.keys(patch).length) { toast("No changes"); return; }
    setBusy(true);
    try {
      await patchNote(n.id, patch);
      toast(t("memoryvault.saved"));
      await props.onChanged();
    } catch (error) {
      toast((error as Error).message, { kind: "error" });
    }
    setBusy(false);
  };

  const archive = async () => {
    const previous = n.status;
    try {
      await patchNote(n.id, { status: "archived" });
      await props.onChanged();
      toast(`Archived ${n.title ?? n.id}`, {
        actionLabel: "Undo",
        onAction: () => {
          patchNote(n.id, { status: previous })
            .then(() => props.onChanged())
            .catch((e: Error) => toast(e.message, { kind: "error" }));
        },
      });
    } catch (error) {
      toast((error as Error).message, { kind: "error" });
    }
  };

  const remove = async () => {
    if (!confirm(t("sourcesworkspace.deleteImportedSourceKeepExtractedMessage", { value1: n.title ?? n.id }))) return;
    try {
      await deleteNote(n.id);
      toast(`Deleted ${n.title ?? n.id}`);
      props.onClose();
      await props.onChanged();
    } catch (error) {
      toast((error as Error).message, { kind: "error" });
    }
  };

  const dedupe = (key: string) => {
    const current = drafts[key] ?? n.sections[key]?.text ?? "";
    const result = dedupeLines(current);
    if (!result) { toast("No near-duplicate lines found"); return; }
    setDrafts((prev) => ({ ...prev, [key]: result.text }));
    toast(`Dropped ${result.dropped} near-duplicate line${result.dropped === 1 ? "" : "s"} · ${(current.length - result.text.length).toLocaleString()} ch freed — save to keep it`);
  };

  return (
    <div class="claim-detail">
      <div class="kvs t-data">
        <div><span class="k">id</span>{n.id}</div>
        <div><span class="k">type</span><span class={`chip t-data type-${n.type}`}>{n.type.replaceAll("_", " ")}</span></div>
        <div><span class="k">status</span>
          <span class="segset" role="group" aria-label="Status">
            {(["active", "resolved", "archived"] as const).map((st) => (
              <button key={st} class={`seg st-${st} t-data`} aria-pressed={status === st} onClick={() => changeStatus(st)}>{st}</button>
            ))}
          </span>
        </div>
        <div><span class="k">modes</span>{(n.modes ?? []).join(", ")}</div>
        <div><span class="k">keywords</span>{(n.keywords ?? []).join(", ") || "—"} <span class="dim">{(n.keywords ?? []).length}/{KEYWORD_CAP}</span></div>
        {(n.links ?? []).length > 0 && (
          <div><span class="k">links</span>
            <span>{n.links.map((l, i) => <span key={i} class="linkline"><span class="dim">{l.relation}</span> → <NoteRef id={l.target} /> </span>)}</span>
          </div>
        )}
      </div>

      {Object.entries(n.sections ?? {}).map(([key, s]) => {
        const value = drafts[key] ?? s.text ?? "";
        const pct = Math.min(100, Math.round((value.length / SECTION_CAP) * 100));
        return (
          <section key={key} class="dsec">
            <h4 class="t-label t-label-s dsec-head">
              <span class="dsec-title">{key}</span>
              <span class="seccount t-data">{value.length.toLocaleString()}<i> / {SECTION_CAP.toLocaleString()}</i></span>
              <button class="chip" onClick={() => dedupe(key)}>Dedupe lines</button>
            </h4>
            <span class="pbar"><i class={pct >= 95 ? "is-over" : pct >= 75 ? "is-near" : ""} style={`width:${pct}%`} /></span>
            <textarea
              class="t-prose edit-area"
              rows={Math.min(14, Math.max(3, Math.ceil(value.length / 60)))}
              value={value}
              onInput={(e) => setDrafts((prev) => ({ ...prev, [key]: e.currentTarget.value }))}
            />
          </section>
        );
      })}

      <div class="group-actions">
        <button class="dock-primary t-label" disabled={busy} onClick={() => void save()}>{t("memoryvault.save")}</button>
        <button class="action-sec t-label" onClick={() => void archive()}>Archive</button>
        <button class="action-sec is-danger-act t-label" onClick={() => void remove()}>{t("sourcesworkspace.deletePermanently")}</button>
      </div>
    </div>
  );
}
