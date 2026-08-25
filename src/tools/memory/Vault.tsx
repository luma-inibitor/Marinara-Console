// Memory Vault — browse and correct what is stored.
// Source notes are audit records, not memories: excluded by default, behind a
// toggle. Cap pressure reads as a gradient on the row. Archive is the
// destructive default (undoable); permanent delete confirms.

import { useEffect, useMemo, useState } from "react";
import { useStore } from "../../lib/store";
import { navigate } from "../../shell/router";
import { refreshLtmStatus } from "./MemoryTool";
import { toast } from "../../shell/toast";
import { type Note, type NoteSection, type NoteType } from "./api/types";
import { KEYWORD_CAP, SECTION_CAP } from "./model/caps";
import { t } from "../../copy";
import { dedupeLines } from "./model/derived";
import { NoteRef } from "./NotePeek";
import { allNotes, archiveNote, discardNote, loadNotes, notesError, notesLoaded, saveNoteSections, setNoteStatus } from "./store/notes";
import { isScoped, noteInScope } from "./model/scope";
import { useScope } from "./store/scope";
import { Back, ICON_SIZE, NoMatches } from "../../ui/icons";
import { Chip, DetailSection, EmptyState, ErrorState, IconButton, Loading, SearchBar, Tag, fuzzyScore, useIsDesktop } from "../../ui";
import { MemoryDetail } from "./detail/MemoryDetail";

type SortKey = "updated" | "title" | "pressure" | "status";

function pressureOf(n: Note): number {
  let worst = 0;
  for (const s of Object.values(n.sections ?? {})) {
    worst = Math.max(worst, (s.text?.length ?? 0) / SECTION_CAP);
  }
  return Math.max(worst, (n.keywords?.length ?? 0) / KEYWORD_CAP);
}

/** The open memory is route state (`#/memory/vault/:id`), not component state,
 *  so a detail view is linkable and the browser's own back button leaves it.
 *  That also replaces the overlay-stack registration this screen used to make:
 *  the route IS the history entry now, and keeping both would push two. */
export function Vault(props: { noteId?: string }) {
  const desktop = useIsDesktop();
  // The records live in the notes store, which is their one owner; only the
  // filters, the sort and the editor's drafts are this screen's own.
  const notes = useStore(allNotes);
  const loaded = useStore(notesLoaded);
  const error = useStore(notesError);
  const [query, setQuery] = useState("");
  const [showSources, setShowSources] = useState(false);
  const [typeFilter, setTypeFilter] = useState<NoteType | null>(null);
  const [sort, setSort] = useState<SortKey>("updated");
  const scope = useScope();
  const openId = props.noteId ?? null;
  // The card is read-only; editing is a mode you enter from it. Leaving the
  // record leaves the mode with it, so a different memory never opens in a
  // state the reader did not ask for.
  const [editing, setEditing] = useState(false);
  useEffect(() => { setEditing(false); }, [openId]);
  const openDetail = (id: string) => navigate(`memory/vault/${id}`);
  const closeDetail = () => navigate("memory/vault");

  useEffect(() => { void loadNotes(); }, []);

  // Scope decides what this view is about, so it narrows the list BEFORE the
  // chips count it — a scoped list beside a global tally is a header that
  // contradicts its own rows.
  const inScope = useMemo(
    () => notes.filter((n) => noteInScope(n, scope)),
    // Scope is a fresh object each render, so depending on it would refilter
    // every time. Its two fields ARE the whole of it, and noteInScope reads
    // nothing else, so listing them covers the object exactly.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [notes, scope.characterId, scope.chatId]);

  const visible = useMemo(() => {
    let list = inScope.filter((n) => (showSources ? n.type === "source" : n.type !== "source"));
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
  }, [inScope, showSources, typeFilter, query, sort]);

  const types = useMemo(() => {
    const m = new Map<NoteType, number>();
    for (const n of inScope) {
      if (n.type === "source") continue;
      m.set(n.type, (m.get(n.type) ?? 0) + 1);
    }
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [inScope]);

  if (error) return <div className="screen"><ErrorState title={t("memoryvault.memoriesCouldNotLoad")} message={error} /></div>;
  if (!loaded) return <div className="screen"><Loading label={t("memoryvault.loadingMemories")} /></div>;

  const memoriesN = inScope.filter((n) => n.type !== "source").length;
  const sourcesN = inScope.length - memoriesN;
  const open = openId ? notes.find((n) => n.id === openId) ?? null : null;

  // One detail, two projections: a right-hand pane on a wide screen, a pushed
  // screen on a phone. The editor keeps its own header in both, because it has
  // no head of its own and needs a way back to the card.
  const detail = open && (editing
    ? (
      <>
        <header className="console"><div className="hrow">
          <IconButton className="hit" label={t("memory.backToVault")} onClick={() => setEditing(false)}>
            <Back size={ICON_SIZE.xl} stroke={1.75} aria-hidden />
          </IconButton>
          <h1 className="console-title">{open.title ?? open.id}</h1>
        </div></header>
        <NoteEditor note={open} onClose={closeDetail} />
      </>
    )
    : <MemoryDetail note={open} onBack={closeDetail} onEdit={() => setEditing(true)} />);

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
              // Scope hid them, not the vault being empty. Saying "no memories
              // yet" over a full vault sends the reader off to import more.
              : isScoped(scope)
                ? <EmptyState title={t("memory.vault.emptyScoped")} body={t("memory.vault.emptyScopedBody")} />
                : <EmptyState title={t("memoryvault.noSavedMemoriesYetImportASourceOrCreate")} />
          )}
          {visible.map((n) => <NoteRow key={n.id} note={n} isOpen={openId === n.id} onOpen={() => openDetail(n.id)} />)}
        </main>
      </div>
      {desktop && (
        <aside className="audit-detail">
          {detail ?? <EmptyState title={t("memory.vault.noneOpen")} body={t("memory.vault.selectToEdit")} />}
        </aside>
      )}
      {!desktop && detail && <div className="stack-screen">{detail}</div>}
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
            <span className="pbar"><i className={p >= 1 ? "is-over" : p >= 0.8 ? "is-near" : ""} style={{ width: `${Math.min(p * 100, 100)}%` }} /></span>
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

function NoteEditor(props: { note: Note; onClose: () => void }) {
  const n = props.note;
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  // One tap changes status immediately (optimistic in the store; low-risk +
  // recoverable).
  const changeStatus = (next: Note["status"]) => {
    if (next === n.status) return;
    setNoteStatus(n.id, next).catch((e: Error) => toast(e.message, { kind: "error" }));
  };

  const save = async () => {
    const sections: Record<string, NoteSection> = {};
    for (const [key, s] of Object.entries(n.sections ?? {})) {
      const v = drafts[key];
      if (v !== undefined && v !== s.text) sections[key] = { ...s, text: v };
    }
    if (!Object.keys(sections).length) { toast(t("memory.noChanges")); return; }
    setBusy(true);
    try {
      await saveNoteSections(n.id, { ...n.sections, ...sections });
      toast(t("memoryvault.saved"));
      void refreshLtmStatus(); // a vault save triggers an index rebuild
    } catch (error) {
      toast((error as Error).message, { kind: "error" });
    }
    setBusy(false);
  };

  const archive = async () => {
    const previous = n.status;
    try {
      await archiveNote(n.id);
      toast(t("memory.vault.archived", { title: n.title ?? n.id }), {
        actionLabel: t("memoryvault.undo"),
        onAction: () => {
          setNoteStatus(n.id, previous).catch((e: Error) => toast(e.message, { kind: "error" }));
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
      await discardNote(n.id);
      toast(t("memory.vault.deleted", { title: n.title ?? n.id }));
      props.onClose();
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
              <button key={st} className={`seg st-${st} t-data`} aria-pressed={n.status === st} onClick={() => changeStatus(st)}>{st}</button>
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
            meter={<span className="pbar"><i className={pct >= 95 ? "is-over" : pct >= 75 ? "is-near" : ""} style={{ width: `${pct}%` }} /></span>}>
            {/* onInput reads the value out before calling the updater: React runs
                the updater during a later render, by which point the event has
                been recycled and currentTarget is null. */}
            <textarea
              className="t-prose edit-area"
              rows={Math.min(14, Math.max(3, Math.ceil(value.length / 60)))}
              value={value}
              onInput={(e) => { const text = e.currentTarget.value; setDrafts((prev) => ({ ...prev, [key]: text })); }}
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
