// Memory Vault — browse and correct what is stored.
// Source notes are audit records, not memories: excluded by default, behind a
// toggle. Cap pressure reads as a gradient on the row. Archive is the
// destructive default (undoable); permanent delete confirms.

import { useEffect, useMemo, useState } from "preact/hooks";
import { openOverlay, closeTopOverlay } from "../../shell/overlays";
import { refreshLtmStatus } from "./MemoryTool";
import { toast } from "../../shell/toast";
import {
  type Note, type NoteType, fetchNotes, patchNote, deleteNote,
  SECTION_CAP, KEYWORD_CAP,
} from "./data";
import { t } from "../../copy";
import { dedupeLines } from "./derived";
import { NoteRef } from "./NotePeek";
import { Back, ICON_SIZE, NoMatches } from "../../ui/icons";
import { Chip, DetailSection, EmptyState, ErrorState, IconButton, Loading, SearchBar, Tag, fuzzyScore, useIsDesktop } from "../../ui";

type SortKey = "updated" | "title" | "pressure" | "status";

function pressureOf(n: Note): number {
  let worst = 0;
  for (const s of Object.values(n.sections ?? {})) {
    worst = Math.max(worst, (s.text?.length ?? 0) / SECTION_CAP);
  }
  return Math.max(worst, (n.keywords?.length ?? 0) / KEYWORD_CAP);
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
      // Fuzzy on the title, plain substring in the body. Subsequence matching
      // across a paragraph matches nearly everything, which is not a search.
      const q = query.toLowerCase();
      list = list.filter((n) =>
        fuzzyScore(query, n.title ?? n.id) !== null ||
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

  if (error) return <div className="screen"><ErrorState title={t("memoryvault.memoriesCouldNotLoad")} message={error} /></div>;
  if (!notes) return <div className="screen"><Loading label={t("memoryvault.loadingMemories")} /></div>;

  const stackOpen = !desktop && Boolean(openId);
  useEffect(() => {
    if (stackOpen) openOverlay(() => setOpenId(null));
  }, [stackOpen]);

  const memoriesN = notes.filter((n) => n.type !== "source").length;
  const sourcesN = notes.length - memoriesN;
  const open = openId ? notes.find((n) => n.id === openId) ?? null : null;

  return (
    <div className={`audit ${desktop ? "is-desktop" : ""}`}>
      <div className="audit-list">
        <header className="console">
          <div className="probe">
            <SearchBar label={t("memoryvault.searchMemories")} value={query}
              onInput={setQuery} count={visible.length} />
          </div>
          <div className="chiprail">
            <Chip pressed={!showSources} onClick={() => setShowSources(false)}>
              {t("longtermmemorynavigation.memories")} <b className="t-num">{memoriesN}</b>
            </Chip>
            <Chip pressed={showSources} onClick={() => setShowSources(true)}>
              {t("memoryvault.sources")} <b className="t-num">{sourcesN}</b>
            </Chip>
            <span className="rail-gap" />
            {types.map(([type, n]) => (
              <Chip key={type} pressed={typeFilter === type} onClick={() => setTypeFilter(typeFilter === type ? null : type)}>
                <span className={`tdot type-${type}`} aria-hidden="true" />{type.replaceAll("_", " ")} {n}
              </Chip>
            ))}
            <span className="rail-gap" />
            {(["updated", "title", "pressure", "status"] as SortKey[]).map((k) => (
              <Chip key={k} pressed={sort === k} onClick={() => setSort(k)}>
                ↓ {{ updated: "Edited", title: "Title", pressure: "Limits", status: "Status" }[k]}
              </Chip>
            ))}
          </div>
        </header>
        <main className="rows mem-rows">
          {visible.length === 0 && (
            // The filtered case earns the magnifier; an empty vault has no
            // search to point at, so it gets the sentence alone.
            (query.trim() || typeFilter)
              ? <EmptyState
                  icon={<NoMatches size={22} stroke={1.75} aria-hidden />}
                  title={t("memoryvault.filteredEmptyDescription", { value1: query.trim() ? t("memoryvault.filteredEmptySearch", { value1: query.trim() }) : (typeFilter ?? "") })} />
              : <EmptyState title={t("memoryvault.noSavedMemoriesYetImportASourceOrCreate")} />
          )}
          {visible.map((n) => <NoteRow key={n.id} note={n} isOpen={openId === n.id} onOpen={() => setOpenId(n.id)} />)}
        </main>
      </div>
      {desktop && (
        <aside className="audit-detail">
          {open
            ? <NoteEditor note={open} onChanged={load} onClose={() => setOpenId(null)} />
            : <EmptyState title={t("memory.vault.noneOpen")} body={t("memory.vault.selectToEdit")} />}
        </aside>
      )}
      {!desktop && open && (
        <div className="stack-screen">
          <header className="console"><div className="hrow">
            <IconButton className="hit" label={t("memory.backToVault")} onClick={closeTopOverlay}>
              <Back size={ICON_SIZE.xl} stroke={1.75} aria-hidden />
            </IconButton>
            <h1 className="console-title">{open.title ?? open.id}</h1>
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
    <div className={`row ${props.isOpen ? "is-open" : ""}`}>
      <button className="row-summary vault-summary" onClick={props.onOpen}>
        <span className="rail-cell"><span className={`tdot type-${n.type}`} aria-hidden="true" /></span>
        <span className="mid">
          <span className="nm">{n.title ?? n.id}</span>
          <span className="metaline t-data">
            <span className={`chip-min type-${n.type}`}>{n.type.replaceAll("_", " ")}</span>
            {n.status !== "active" && <><i className="sep" data-contrast-exempt>·</i>{n.status}</>}
            <i className="sep" data-contrast-exempt>·</i><span className="dim">{(n.modes ?? []).join(" ")}</span>
            {p >= 0.8 && <><i className="sep" data-contrast-exempt>·</i><span className="fl">{p >= 1 ? t("memory.overLimit") : t("memory.nearLimit")}</span></>}
          </span>
          {p >= 0.5 && (
            <span className="pbar"><i className={p >= 1 ? "is-over" : p >= 0.8 ? "is-near" : ""} style={`width:${Math.min(p * 100, 100)}%`} /></span>
          )}
        </span>
        <span className="num">
          <span className={`tok ${p >= 0.8 ? "is-hot" : ""}`}>{(chars / 1000).toFixed(1)}k</span>
          <span className="unit">{t("ui.editor.charUnit")}</span>
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
    if (!Object.keys(patch).length) { toast(t("memory.noChanges")); return; }
    setBusy(true);
    try {
      await patchNote(n.id, patch);
      toast(t("memoryvault.saved"));
      await props.onChanged();
      void refreshLtmStatus(); // a vault save triggers an index rebuild
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
      toast(t("memory.vault.archived", { title: n.title ?? n.id }), {
        actionLabel: t("memoryvault.undo"),
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
    const message = n.type === "source"
      ? t("sourcesworkspace.deleteImportedSourceKeepExtractedMessage", { value1: n.title ?? n.id })
      : t("memory.vault.deleteConfirm", { title: n.title ?? n.id });
    if (!confirm(message)) return;
    try {
      await deleteNote(n.id);
      toast(t("memory.vault.deleted", { title: n.title ?? n.id }));
      props.onClose();
      await props.onChanged();
    } catch (error) {
      toast((error as Error).message, { kind: "error" });
    }
  };

  const dedupe = (key: string) => {
    const current = drafts[key] ?? n.sections[key]?.text ?? "";
    const result = dedupeLines(current);
    if (!result) { toast(t("memory.vault.noDupeLines")); return; }
    setDrafts((prev) => ({ ...prev, [key]: result.text }));
    toast(t("memory.vault.dedupeResult", {
      count: result.dropped,
      chars: (current.length - result.text.length).toLocaleString(),
    }));
  };

  return (
    <div className="claim-detail">
      <div className="kvs t-data">
        <div><span className="k">{t("memory.vault.id")}</span>{n.id}</div>
        <div><span className="k">type</span><Tag className={`type-${n.type}`}>{n.type.replaceAll("_", " ")}</Tag></div>
        <div><span className="k">status</span>
          <span className="segset" role="group" aria-label="Status">
            {(["active", "resolved", "archived"] as const).map((st) => (
              <button key={st} className={`seg st-${st} t-data`} aria-pressed={status === st} onClick={() => changeStatus(st)}>{st}</button>
            ))}
          </span>
        </div>
        <div><span className="k">modes</span>{(n.modes ?? []).join(", ")}</div>
        <div><span className="k">keywords</span>{(n.keywords ?? []).join(", ") || "—"} <span className="dim">{(n.keywords ?? []).length}/{KEYWORD_CAP}</span></div>
        {(n.links ?? []).length > 0 && (
          <div><span className="k">{t("memory.vault.links")}</span>
            <span>{n.links.map((l, i) => <span key={i} className="linkline"><span className="dim">{l.relation}</span> → <NoteRef id={l.target} /> </span>)}</span>
          </div>
        )}
      </div>

      {Object.entries(n.sections ?? {}).map(([key, s]) => {
        const value = drafts[key] ?? s.text ?? "";
        const pct = Math.min(100, Math.round((value.length / SECTION_CAP) * 100));
        return (
          <DetailSection key={key} sectionKey={key}
            meta={<>
              <span className="seccount t-data">{value.length.toLocaleString()}<i> / {SECTION_CAP.toLocaleString()}</i></span>
              <Chip onClick={() => dedupe(key)}>{t("memory.vault.dedupeLines")}</Chip>
            </>}
            meter={<span className="pbar"><i className={pct >= 95 ? "is-over" : pct >= 75 ? "is-near" : ""} style={`width:${pct}%`} /></span>}>
            <textarea
              className="t-prose edit-area"
              rows={Math.min(14, Math.max(3, Math.ceil(value.length / 60)))}
              value={value}
              onInput={(e) => setDrafts((prev) => ({ ...prev, [key]: e.currentTarget.value }))}
            />
          </DetailSection>
        );
      })}

      <div className="group-actions">
        <button className="dock-primary t-label" disabled={busy} onClick={() => void save()}>{t("memoryvault.save")}</button>
        <button className="action-sec t-label" onClick={() => void archive()}>{t("memoryvault.archive")}</button>
        <button className="action-sec is-danger-act t-label" onClick={() => void remove()}>{t("sourcesworkspace.deletePermanently")}</button>
      </div>
    </div>
  );
}
