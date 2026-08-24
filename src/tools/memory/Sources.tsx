// Sources — browse to import.
//
// This screen is browsed to import and never for maintenance, so import is the
// spine: one dense line per source carrying title and state only. Two
// interaction models by kind — lorebooks and characters go in bulk, chat
// summaries are curated and edited one at a time — and both live in the same
// list, because expanding a row in place keeps the list as the context.
//
// Every state name and action verb here comes from the product catalog.

import { useEffect, useMemo, useState } from "react";
import { createStore, useStore } from "../../lib/store";
import {
  NoMatches, ChevronRight, ChevronDown, ExternalLink, Confirm,
  Failure, Cost, Info, Edit, Forward, AllClear, Pending, Close, ICON_SIZE,
  SOURCE_KIND_ICON, SOURCE_STATE_ICON, type Icon,
} from "../../ui/icons";
import { navigate } from "../../shell/router";
import { api } from "../../shell/api";
import { toast } from "../../shell/toast";
import type { ImportPreview, ImportResult, Note } from "./api/types";
import { fetchNotes } from "./api/notes";
import { fetchReview } from "./api/drafts";
import { importPreview, importSourceNotes } from "./api/import";
import { t } from "../../copy";
import { Copy } from "./Copy";
import { focusSource, refreshLtmStatus } from "./MemoryTool";
import { TypeIcon } from "./icons";
import { pendingSources } from "./store";
import { scopeChatId, setScope } from "./store/scope";
import {
  buildSources, isSelectable, isImported, partition,
  type SourceKind, type SourceRow, type SourceState,
} from "./model/sources";
import { collapsedGroups, Edu, EmptyState, IconButton, ListGroup, Loading, Modal, ModePill, MODES, SearchBar, fuzzyFilter } from "../../ui";
import { closeTopOverlay } from "../../shell/overlays";

/** Above this many sources, spending model calls raises a confirm first. */
const CONFIRM_THRESHOLD = 10;

// The registry keys its source kinds by the engine's singular names
// (lorebook / chat_summary / character); this screen's SourceKind ids are the
// plural bucket names, so the two vocabularies are bridged here, once.
const KINDS: Array<{ id: SourceKind; label: () => string; icon: Icon; bulk: boolean }> = [
  { id: "lorebooks", label: () => t("sourcesworkspace.lorebooks"), icon: SOURCE_KIND_ICON.lorebook, bulk: true },
  { id: "chats", label: () => t("sourcesworkspace.chatSummaries"), icon: SOURCE_KIND_ICON.chat_summary, bulk: false },
  { id: "characters", label: () => t("sourcesworkspace.characters"), icon: SOURCE_KIND_ICON.character, bulk: true },
];

/** The lorebook glyph on its own, for the "no lorebooks in scope" empty state. */
const Lorebook = SOURCE_KIND_ICON.lorebook;

const STATE_LABEL: Record<SourceState, string> = {
  new: t("sourcesworkspace.new"),
  current: t("sourcesworkspace.alreadyImported"),
  source_updated: t("sourcesworkspace.updateAvailable"),
  context_updated: t("sourcesworkspace.contextChanged"),
  extraction_incomplete: t("sourcesworkspace.extractionIncomplete"),
  source_missing: t("reviewqueue.sourceMissing"),
};
const STATE_MEANING: Record<SourceState, string> = {
  new: "not imported yet",
  current: "the extraction matches the source",
  source_updated: "the source text changed after extraction",
  context_updated: "the text is unchanged; the scope or modes around it changed",
  extraction_incomplete: "extraction finished with rejections",
  source_missing: "the source note is gone",
};

/** New carries no mark — it is the majority state, and marking it would put a
 *  symbol on nearly every row while the exceptions fought for attention. */
function StateMark({ state }: { state: SourceState }) {
  if (state === "new") return <span className="s-slot" />;
  const I = SOURCE_STATE_ICON[state];
  const tone = state === "current" ? "s-ok"
    : state === "source_missing" ? "s-danger"
    : state === "context_updated" ? "s-info" : "s-warn";
  return (
    <span className={`stg ${tone}`} title={`${STATE_LABEL[state]} — ${STATE_MEANING[state]}`}>
      <I size={14} stroke={1.75} aria-hidden />
      <span className="sw t-data">{STATE_LABEL[state]}</span>
    </span>
  );
}

/** The price rides on the button: Import and extract always extracts, one
 *  model call per source, so a separate chip would repeat the count. */
function Spend({ n }: { n: number }) {
  return <span className="spend"><Cost size={12} stroke={1.75} aria-hidden />{n}</span>;
}

interface Chat { id: string; name?: string; mode?: string }


const openRow = createStore<string | null>(null);
const railView = createStore<"pending" | "imported" | "all">("pending");

/** Same collapse vocabulary as the review queue: a chevron in the control
 *  column, and a collapsed group keeps its header and its count so the
 *  collapsed state is still informative. Persisted per view, because these
 *  groups run to ninety rows and re-collapsing them every visit is a chore. */
const collapse = collapsedGroups("mc-ltm-sources-collapsed");

export function Sources() {
  const [previews, setPreviews] = useState<Map<SourceKind, ImportPreview>>(new Map());
  const [errors, setErrors] = useState<Map<SourceKind, string>>(new Map());
  const [notes, setNotes] = useState<Note[]>([]);
  const [review, setReview] = useState<Awaited<ReturnType<typeof fetchReview>> | null>(null);
  const [chats, setChats] = useState<Chat[]>([]);
  const [q, setQ] = useState("");
  // Mode filters what a source imports as. It is not a scope level: it does not
  // cascade, and the engine records it separately from scope (nav-wire §N6).
  const [modes, setModes] = useState<Set<string>>(new Set(MODES.map((m) => m.id)));
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [job, setJob] = useState<{ done: number; total: number; stopped?: boolean } | null>(null);
  const [results, setResults] = useState<ImportResult[] | null>(null);
  const [confirmN, setConfirmN] = useState<number | null>(null);
  const stopRef = useState<{ v: boolean }>({ v: false })[0];
  const chatId = useStore(scopeChatId);
  const rail = useStore(railView);
  const collapsedIds = collapse.useCollapsed();

  const load = async () => {
    setLoading(true);
    const next = new Map<SourceKind, ImportPreview>();
    const errs = new Map<SourceKind, string>();
    await Promise.all(KINDS.map(async ({ id }) => {
      try { next.set(id, await importPreview(id)); }
      catch (error) { errs.set(id, (error as Error).message); }
    }));
    setPreviews(next);
    setErrors(errs);
    try { setNotes(await fetchNotes({ limit: 500 })); } catch { setNotes([]); }
    try { setReview(await fetchReview()); } catch { setReview(null); }
    setLoading(false);
  };

  useEffect(() => {
    void load();
    api<Chat[] | { items: Chat[] }>("/chats")
      .then((r) => setChats(Array.isArray(r) ? r : r.items ?? []))
      .catch(() => setChats([]));
  }, [chatId]);

  const rows = useMemo(() => buildSources(previews, review, notes), [previews, review, notes]);
  const { pending, imported, all } = partition(rows);
  useEffect(() => { pendingSources.set(pending.length); }, [pending.length]);
  const blockedDrafts = useMemo(
    () => (review?.sources ?? []).flatMap((s) => s.drafts.filter((d) => d.blockReasons.length)),
    [review]);

  const view = rail === "pending" ? pending : rail === "imported" ? imported : all;
  const byMode = modes.size === MODES.length ? view : view.filter((r) => modes.has(r.importMode));
  // fuzzy: source titles are long and repetitive, and "hh" should find
  // "Harbour Household" without the reviewer typing the whole thing
  const shown = fuzzyFilter(byMode, q, (r) => r.title);

  const selectedRows = rows.filter((r) => selected.has(r.sourceId));
  const toggle = (id: string) => setSelected((prev) => {
    const n = new Set(prev);
    n.has(id) ? n.delete(id) : n.add(id);
    return n;
  });

  const runImport = async (batch: SourceRow[]) => {
    setConfirmN(null);
    stopRef.v = false;
    setResults(null);
    setJob({ done: 0, total: batch.length });
    const out: ImportResult[] = [];
    for (const [i, r] of batch.entries()) {
      if (stopRef.v) { setJob({ done: i, total: batch.length, stopped: true }); break; }
      setJob({ done: i, total: batch.length });
      try {
        const body: Record<string, unknown> = { source: r.kind, sourceIds: [r.sourceId], extract: true };
        if (scopeChatId.get()) body.chatId = scopeChatId.get();
        out.push(await importSourceNotes(body));
      } catch (error) {
        out.push({ batchStatus: "failed", source: r.kind, imported: [{ sourceId: r.sourceId, title: r.title }] } as ImportResult);
        toast(`${r.title}: ${(error as Error).message}`, { kind: "error" });
      }
    }
    if (!stopRef.v) setJob(null);
    setResults(out);
    setSelected(new Set());
    await load();
    void refreshLtmStatus();
  };

  const start = (batch: SourceRow[]) => {
    if (batch.length > CONFIRM_THRESHOLD) setConfirmN(batch.length);
    else void runImport(batch);
  };

  return (
    <div className="audit"><div className="audit-list">
      <header className="console">
        <div className="sbar">
          <SearchBar label={t("memory.sources.search")} value={q} onInput={setQ} count={shown.length} />
          <ModePill modes={modes} onToggle={(id) => setModes((prev) => {
            const n = new Set(prev);
            n.has(id) ? n.delete(id) : n.add(id);
            return n.size ? n : new Set(MODES.map((m) => m.id)); // never filter everything away
          })} />
        </div>
        <div className="qrail">
          <RailChip id="pending" label={t("memory.sourcesPending")} n={pending.length} />
          <RailChip id="imported" label={t("sourcesworkspace.alreadyImported")} n={imported.length} />
          <RailChip id="all" label={t("sourcesworkspace.all")} n={all.length} />
          {blockedDrafts.length > 0 && (
            <>
              <span className="qsp" />
              <a className="qchip qblock" href="#/memory/review">
                {t("memory.sourcesBlocked")} <b>{t("memory.review.blockedDrafts", { count: blockedDrafts.length, n: blockedDrafts.length })}</b>
              </a>
            </>
          )}
        </div>
      </header>

      <main className="rows mem-rows">
        {results && <ImportReport results={results} onDismiss={() => setResults(null)} />}
        {job && <JobDock job={job} onStop={() => { stopRef.v = true; }}
          onResume={(rest) => void runImport(rest)} rest={selectedRows.slice(job.done)} />}

        {loading && <Loading label={t("sourcesworkspace.loadingSourcePreview")} />}
        {!loading && shown.length === 0 && <SourcesEmpty q={q} rows={rows} view={rail} chats={chats} />}

        {!loading && KINDS.flatMap(({ id, label, icon: KI, bulk }) => {
          const inKind = shown.filter((r) => r.kind === id);
          const err = errors.get(id);
          if (err) return [<div key={id} className="mem-card is-danger"><b className="t-prose">{label()}</b><p className="t-data dim">{err}</p></div>];
          if (!inKind.length) return [];
          // Lorebook entries list under their book; everything else under its kind.
          const names = id === "lorebooks"
            ? [...new Set(inKind.map((r) => r.group))]
            : [""];
          return names.map((gname) => {
          const group = gname ? inKind.filter((r) => r.group === gname) : inKind;
          const heading = gname || label();
          const gid = id + "/" + gname;
          const collapsed = collapsedIds.has(gid);
          const eligible = group.filter(isSelectable);
          const allPicked = eligible.length > 0 && eligible.every((r) => selected.has(r.sourceId));
          return (
            <ListGroup key={id + gname} className="sghead" chevronSize={15}
              collapsed={collapsed} onToggle={() => collapse.toggle(gid)}
              label={heading} count={group.length}
              head={<>
                <span className="ki"><KI size={15} stroke={1.75} aria-hidden /></span>
                <span className="gname">{heading}</span>
                <span className="gn t-data">{group.length}</span>
                <span className="gsp" />
                {bulk && eligible.length > 0 && (
                  <button className="gact hit" aria-pressed={allPicked}
                    onClick={() => setSelected((prev) => {
                      const n = new Set(prev);
                      if (allPicked) eligible.forEach((r) => n.delete(r.sourceId));
                      else eligible.forEach((r) => n.add(r.sourceId));
                      return n;
                    })}>
                    {allPicked ? "Clear" : `Select all ${eligible.length}`}
                  </button>
                )}
                {!bulk && <span className="gact-note t-data dim">{t("memory.sourcesReviewEach")}</span>}
              </>}>
              {group.map((r) => (
                <SourceLine key={r.sourceId} row={r} bulk={bulk}
                  selected={selected.has(r.sourceId)} onToggle={() => toggle(r.sourceId)}
                  onReload={load} />
              ))}
            </ListGroup>
          );
          });
        })}

        {!loading && shown.length > 0 && (
          <p className="trunc t-data"><Info size={12} stroke={1.75} aria-hidden />
            <span>{t("sourcesworkspace.selectUpTo100SourceParts")}</span></p>
        )}
      </main>

      {selected.size > 0 && !job && (
        <div className="apply-dock">
          <span className="gsp" />
          <button className="dock-primary t-label" onClick={() => start(selectedRows)}>
            {t("sourcesworkspace.importSelected_7fb57e8")} <Spend n={selectedRows.length} />
          </button>
        </div>
      )}

      {confirmN !== null && (
        <ConfirmSheet n={confirmN} chats={chats}
          onCancel={() => setConfirmN(null)} onGo={() => void runImport(selectedRows)} />
      )}
    </div></div>
  );
}

function RailChip({ id, label, n }: { id: "pending" | "imported" | "all"; label: string; n: number }) {
  const rail = useStore(railView);
  return (
    <button className="qchip hit" aria-pressed={rail === id} onClick={() => { railView.set(id); }}>
      {label} <b>{n}</b>
    </button>
  );
}


// ── one line per source, expanding in place ─────────────────────────
// Chat summaries expand to their extraction text, because they must be
// curated and edited before import. An imported source expands to what it
// produced. One gesture, two payloads.

function SourceLine({ row, bulk, selected, onToggle, onReload }: {
  row: SourceRow; bulk: boolean; selected: boolean; onToggle: () => void; onReload: () => Promise<void>;
}) {
  const expandable = !bulk || isImported(row);
  const open = useStore(openRow) === row.sourceId;
  const KI = KINDS.find((k) => k.id === row.kind)?.icon ?? SOURCE_KIND_ICON.character;
  return (
    <>
      <div className={`srow ${selected ? "is-sel" : ""} ${open ? "is-open" : ""}`}>
        {bulk && (
          <button className={`sbox hit ${selected ? "on" : ""}`} role="checkbox" aria-checked={selected}
            aria-label={`Select ${row.title}`} disabled={!isSelectable(row)} onClick={onToggle}>
            {selected && <Confirm size={12} stroke={2.5} aria-hidden />}
          </button>
        )}
        {expandable && (
          <button className="xchev hit" aria-expanded={open} aria-label={open ? t("memory.collapse") : t("memory.expand")}
            onClick={() => { openRow.set(open ? null : row.sourceId); }}>
            {open ? <ChevronDown size={13} stroke={1.75} aria-hidden />
                  : <ChevronRight size={13} stroke={1.75} aria-hidden />}
          </button>
        )}
        <span className="ki"><KI size={14} stroke={1.75} aria-hidden /></span>
        <span className="stitle">{row.title}</span>
        <StateMark state={row.state} />
        {row.kind === "lorebooks" && (
          <button className="jumpb hit" aria-label={t("memory.sources.openInLorebooks", { title: row.title })}
            onClick={() => navigate("lorebooks")}>
            <ExternalLink size={14} stroke={1.75} aria-hidden />
          </button>
        )}
      </div>
      {open && (isImported(row)
        ? <ProducedPanel row={row} />
        : <CuratePanel row={row} onImported={onReload} />)}
    </>
  );
}

// ── what a source produced ──────────────────────────────────────────
function ProducedPanel({ row }: { row: SourceRow }) {
  const [showAll, setShowAll] = useState(false);
  const head = showAll ? row.derived : row.derived.slice(0, 3);
  return (
    <div className="xbody">
      <div className="z-eye t-label t-label-s">
        <span className="z-lab">{t("memoryvault.memoriesCreatedFromThisSource")}</span>
        <span className="zcount t-data">{row.derived.length}</span>
      </div>
      <div className="memlist">
        {head.map((m) => (
          <div key={m.id} className="mrow2">
            <TypeIcon type={m.type} size={13} />
            <span className="stitle">{m.title}</span>
          </div>
        ))}
        {row.derived.length > 3 && !showAll && (
          <button className="fold-btn t-data hit" onClick={() => setShowAll(true)}>
            <ChevronRight size={12} stroke={1.75} aria-hidden /> {t("memory.sources.moreDerived", { count: row.derived.length - 3 })}
          </button>
        )}
        {row.derived.length === 0 && <p className="t-prose dim">{t("sourcesworkspace.noSourcesHaveBeenImportedInThisScope")}</p>}
      </div>
      <div className={`pendrow ${row.pending ? "" : "is-quiet"}`}>
        {row.pending
          ? <Pending size={14} stroke={1.75} aria-hidden />
          : <AllClear className="s-ok" size={14} stroke={1.75} aria-hidden />}
        <span className="t-prose">
          {row.pending
            ? t("memory.sources.awaitReview", { count: row.pending })
            : t("reviewqueue.noProposedMemoriesAwaitReviewForSource")}
        </span>
        <span className="gsp" />
        {row.pending > 0 && row.noteId && (
          <button className="action-sec hit" onClick={() => { focusSource(row.noteId!); navigate("memory/review"); }}>
            {t("longtermmemorydetail.openReviewQueue")} <Forward size={12} stroke={1.75} aria-hidden />
          </button>
        )}
      </div>
    </div>
  );
}

// ── curate: read the extraction text, edit it, import it ────────────
const overrides = createStore<Map<string, string>>(new Map());

function CuratePanel({ row, onImported }: { row: SourceRow; onImported: () => Promise<void> }) {
  const staged = useStore(overrides);
  const stored = staged.get(row.sourceId) ?? row.snippet;
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(stored);
  const [busy, setBusy] = useState(false);
  const edited = staged.has(row.sourceId);

  const save = () => {
    if (!draft.trim()) { toast(t("reviewqueue.sectionTextCannotBeEmpty"), { kind: "error" }); return; }
    const next = new Map(overrides.get());
    next.set(row.sourceId, draft);
    overrides.set(next);
    setEditing(false);
  };

  const importOne = async () => {
    setBusy(true);
    try {
      const body: Record<string, unknown> = { source: row.kind, sourceIds: [row.sourceId], extract: true };
      if (scopeChatId.get()) body.chatId = scopeChatId.get();
      await importSourceNotes(body);
      toast(t("sourcesworkspace.sourceImportComplete"));
      openRow.set(null);
      await onImported();
    } catch (error) {
      toast((error as Error).message, { kind: "error" });
    }
    setBusy(false);
  };

  return (
    <div className="xbody">
      <div className={`zone ${editing ? "is-editing" : ""}`}>
        <div className="z-eye t-label t-label-s">
          <span className="z-lab">{t("memory.extractionText")}{editing && <> · {t("memory.editing")}</>}</span>
          {!editing && (
            <button className="zbtn hit" onClick={() => { setDraft(stored); setEditing(true); }}>
              <Edit size={12} stroke={1.75} aria-hidden /> {t("longtermmemorydetail.reviewEdit")}
            </button>
          )}
        </div>
        {editing
          ? <textarea className="editarea t-prose" rows={Math.min(10, Math.max(3, Math.ceil(draft.length / 60)))}
              value={draft} onInput={(e) => setDraft(e.currentTarget.value)} />
          : <div className="t-prose xtext">{stored}</div>}
        <div className="z-foot t-data dim">{(editing ? draft : stored).length.toLocaleString()} {t("ui.editor.charUnit")}</div>
      </div>
      {!editing && <Edu>{t("memory.sources.extractionTextHelp")}</Edu>}
      <div className="curbar">
        {editing ? (
          <>
            <button className="dbtn2 save-on hit" onClick={save}>{t("memoryvault.save")}</button>
            <button className="dbtn2 hit" onClick={() => setEditing(false)}>{t("memorysettings.discardChanges")}</button>
            <span className="gsp" />
            <span className="barnote t-data">{t("memory.sources.overrideNote")}</span>
          </>
        ) : (
          <>
            <button className="dbtn2 keepish hit" disabled={busy} onClick={() => void importOne()}>
              <Confirm size={15} stroke={1.75} aria-hidden />
              {busy ? t("sourcesworkspace.savingAndExtracting", { count: 1 }) : t("sourcesworkspace.importValue1", { value1: "" }).trim()}
              {!busy && <Spend n={1} />}
            </button>
            <span className="gsp" />
            {edited && <span className="dirty t-data"><Edit size={12} stroke={1.75} aria-hidden />{t("memoryvault.editedManually")}</span>}
            <button className="dbtn2 hit" onClick={() => { openRow.set(null); }}>{t("longtermmemorydetail.reviewSkip")}</button>
          </>
        )}
      </div>
    </div>
  );
}

// ── the job: progress, and a stop that says what it keeps ───────────
function JobDock({ job, onStop, onResume, rest }: {
  job: { done: number; total: number; stopped?: boolean };
  onStop: () => void; onResume: (rest: SourceRow[]) => void; rest: SourceRow[];
}) {
  if (job.stopped) {
    return (
      <div className="idock jobdock">
        <div className="jobline">
          <span className="dcount t-data">{t("memory.sources.stopped", { done: job.done, total: job.total })}</span>
          <span className="gsp" />
          {rest.length > 0 && (
            <button className="dock-primary t-label" onClick={() => onResume(rest)}>
              {t("sourcesworkspace.importSelected_7fb57e8")} <Spend n={rest.length} />
            </button>
          )}
        </div>
      </div>
    );
  }
  return (
    <div className="idock jobdock" role="status" aria-live="polite">
      <div className="jobline">
        <span className="dcount t-data">
          {t("sourcesworkspace.savingAndExtracting", { count: job.total })} {job.done} / {job.total}
        </span>
        <span className="gsp" />
        <button className="action-sec hit" onClick={onStop}>{t("memory.stop")}</button>
      </div>
      <span className="jbar"><i style={{ width: `${Math.round((job.done / Math.max(1, job.total)) * 100)}%` }} /></span>
      <p className="jobnote t-data dim">
        <Info size={12} stroke={1.75} aria-hidden />
        <span>{t("memory.sources.stopNote")}</span>
      </p>
    </div>
  );
}

// ── the confirm, above the threshold only ───────────────────────────
function ConfirmSheet({ n, chats, onCancel, onGo }: {
  n: number; chats: Chat[]; onCancel: () => void; onGo: () => void;
}) {
  const chatId = useStore(scopeChatId);
  const scope = chats.find((c) => c.id === chatId);
  return (
    <Modal label={t("memory.sources.confirmImport")} onClose={onCancel}>
      <div className="chead"><Cost size={16} stroke={1.75} aria-hidden />
        <b className="t-prose">{t("sourcesworkspace.importValue1", { value1: String(n) })}?</b></div>
      <div className="cbody">
        <div className="crow"><span className="ck t-label t-label-s">{t("memory.zoneExtraction")}</span>
          <span className="t-prose">{t("sourcesworkspace.savingAndExtracting", { count: n })} {t("memory.sources.oneModelCall")}</span></div>
        <div className="crow"><span className="ck t-label t-label-s">{t("memory.confirm.scope")}</span>
          <span className="t-prose">{scope ? (scope.name ?? scope.id) : t("sourcesworkspace.allChats")}</span></div>
        <div className="crow"><span className="ck t-label t-label-s">{t("memory.confirm.after")}</span>
          <span className="t-prose">{t("sourcesworkspace.importExplanation")}</span></div>
      </div>
      <div className="cfoot">
        <button className="dock-primary t-label" onClick={onGo}>
          {t("sourcesworkspace.importSelected_7fb57e8")} <Spend n={n} />
        </button>
        {/* Cancel goes through the stack, not straight to onCancel, so the
            history entry Modal pushed is popped with it. */}
        <button className="action-sec hit" onClick={closeTopOverlay}>{t("memoryvault.cancel")}</button>
      </div>
    </Modal>
  );
}

// ── what came back ──────────────────────────────────────────────────
function ImportReport({ results, onDismiss }: { results: ImportResult[]; onDismiss: () => void }) {
  const [openDetail, setOpenDetail] = useState(false);
  const rows = results.flatMap((res) => res.imported.map((item) => {
    const a = item.draft?.accounting;
    const cands = a ? a.providerCandidates + a.normalizedAdditions : 0;
    const failed = res.batchStatus === "failed" || (!item.draft && !item.note);
    return { title: item.title, kept: a?.keptUnits ?? 0, rejected: a ? cands - a.keptUnits : 0, failed };
  }));
  const ok = rows.filter((r) => !r.failed);
  const bad = rows.filter((r) => r.failed);
  const kept = ok.reduce((n, r) => n + r.kept, 0);
  return (
    <div className="mem-card resultcard">
      <div className="reshead2">
        <AllClear className="s-ok" size={17} stroke={1.75} aria-hidden />
        <div>
          <div className="restitle">{t("sourcesworkspace.sourceImportComplete")}</div>
          <div className="ressub t-prose dim">
            {t("memory.sources.reportSummary", { ok: ok.length, total: rows.length, kept })}
          </div>
        </div>
        <span className="gsp" />
        <IconButton className="hit" label="Dismiss report" onClick={onDismiss}>
          <Close size={ICON_SIZE.xl} stroke={1.75} aria-hidden />
        </IconButton>
      </div>

      {bad.map((r) => (
        <div key={r.title} className="failblock">
          <div className="failhead"><Failure size={15} stroke={1.75} aria-hidden />
            <span className="failname">{r.title}</span></div>
          <p className="failwhy t-prose dim">{t("sourcesworkspace.sourceSavedExtractionFailed")}</p>
        </div>
      ))}

      {ok.length > 0 && (
        <>
          <button className="fold-btn t-data hit" aria-expanded={openDetail} onClick={() => setOpenDetail(!openDetail)}>
            {openDetail ? <ChevronDown size={12} stroke={1.75} aria-hidden /> : <ChevronRight size={12} stroke={1.75} aria-hidden />}
            {t("memory.sources.perSourceDetail")}
          </button>
          {openDetail && (
            <div className="rtable">
              <div className="rhead t-label t-label-s"><span>{t("reviewqueue.source")}</span>
                <span className="rnum">{t("memory.report.kept")}</span><span className="rnum">{t("activityview.rejected")}</span></div>
              {ok.map((r) => (
                <div key={r.title} className="rrow t-prose">
                  <span className="rname"><span>{r.title}</span></span>
                  <span className="rnum t-data">{r.kept}</span>
                  <span className={`rnum t-data ${r.rejected ? "" : "zero"}`}>{r.rejected || "—"}</span>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      <div className="resfoot">
        <button className="dock-primary t-label" onClick={() => navigate("memory/review")}>
          {t("longtermmemorydetail.openReviewQueue")} <Forward size={13} stroke={1.75} aria-hidden />
        </button>
      </div>
      <Edu>{t("sourcesworkspace.importExplanation")}</Edu>
    </div>
  );
}

// ── nothing to show, and why ────────────────────────────────────────
function SourcesEmpty({ q, rows, view, chats }: {
  q: string; rows: SourceRow[]; view: "pending" | "imported" | "all"; chats: Chat[];
}) {
  const chatId = useStore(scopeChatId);
  const scoped = Boolean(chatId);
  const scopeName = chats.find((c) => c.id === chatId)?.name ?? t("memory.sources.thisChat");

  if (q.trim()) {
    return (
      <EmptyState
        icon={<NoMatches size={22} stroke={1.75} aria-hidden />}
        title={t("memory.noMatchingSources")}
        body={<Copy
          k={scoped ? "memory.sources.searchEmptyScoped" : "memory.sources.searchEmpty"}
          params={{ count: rows.length }}
          slots={{ query: <b>{q.trim()}</b>, scope: <b>{scopeName}</b> }} />}
      />
    );
  }
  if (rows.length === 0 && scoped) {
    return (
      <EmptyState
        icon={<Lorebook size={22} stroke={1.75} aria-hidden />}
        title={t("sourcesworkspace.noLorebooksAreAvailableInThisScope")}
        body={t("memory.sources.emptyScopedBody")}
        actions={
          <button className="action-sec hit" onClick={() => setScope("")}>
            {t("sourcesworkspace.importScope")}: {t("sourcesworkspace.allChats")}
          </button>
        }
      />
    );
  }
  // the default view is a filter that empties as the reviewer succeeds
  return (
    <EmptyState
      tone="ok"
      icon={<AllClear size={22} stroke={1.75} aria-hidden />}
      title={view === "pending"
        ? t("sourcesworkspace.noNewOrRetryableSourcesAreReadyToImport")
        : t("sourcesworkspace.noSourcesHaveBeenImportedInThisScope")}
      body={view === "pending"
        ? t("memory.sources.emptyPendingBody")
        : t("memory.sources.emptyImportedBody")}
      actions={view === "pending" && (
        <button className="dock-primary t-label" onClick={() => navigate("memory/review")}>
          {t("longtermmemorydetail.openReviewQueue")}
        </button>
      )}
    />
  );
}
