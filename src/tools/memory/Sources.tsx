// Sources — browse to import (approved specimens: public/mockups/sources-v1.html).
//
// The owner browses this screen to import and never for maintenance, so import
// is the spine: one dense line per source carrying title and state only. Two
// interaction models by kind — lorebooks and characters go in bulk, chat
// summaries are curated and edited one at a time — and both live in the same
// list, because expanding a row in place keeps the list as the context.
//
// Every state name and action verb here comes from the product catalog.

import { useEffect, useMemo, useState } from "preact/hooks";
import { signal } from "@preact/signals";
import {
  IconBook2, IconMessageCircle, IconUser, IconSearch, IconFilter, IconChevronRight,
  IconChevronDown, IconExternalLink, IconCheck, IconRefreshAlert, IconAdjustments,
  IconAlertTriangle, IconUnlink, IconSparkles, IconInfoCircle, IconPencil, IconArrowRight,
  IconCircleCheck, IconCircleDashed,
} from "@tabler/icons-preact";
import { navigate } from "../../shell/router";
import { api } from "../../shell/api";
import { toast } from "../../shell/toast";
import {
  type ImportPreview, type ImportResult, type Note,
  importPreview, importSourceNotes, fetchNotes, fetchReview,
} from "./data";
import { t, OURS } from "./strings";
import { focusSource, refreshLtmStatus } from "./MemoryTool";
import { TypeIcon } from "./icons";
import { scopeChatId, setScope } from "./store";
import {
  buildSources, isSelectable, isImported, partition,
  type SourceKind, type SourceRow, type SourceState,
} from "./sourceModel";

/** Above this many sources, spending model calls raises a confirm first. */
const CONFIRM_THRESHOLD = 10;

const KINDS: Array<{ id: SourceKind; label: () => string; icon: typeof IconBook2; bulk: boolean }> = [
  { id: "lorebooks", label: () => t("sourcesworkspace.lorebooks"), icon: IconBook2, bulk: true },
  { id: "chats", label: () => t("sourcesworkspace.chatSummaries"), icon: IconMessageCircle, bulk: false },
  { id: "characters", label: () => t("sourcesworkspace.characters"), icon: IconUser, bulk: true },
];

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
  if (state === "new") return <span class="s-slot" />;
  const I = state === "current" ? IconCheck
    : state === "source_updated" ? IconRefreshAlert
    : state === "context_updated" ? IconAdjustments
    : state === "extraction_incomplete" ? IconAlertTriangle
    : IconUnlink;
  const tone = state === "current" ? "s-ok"
    : state === "source_missing" ? "s-danger"
    : state === "context_updated" ? "s-info" : "s-warn";
  return (
    <span class={`stg ${tone}`} title={`${STATE_LABEL[state]} — ${STATE_MEANING[state]}`}>
      <I size={14} stroke={1.75} aria-hidden />
      <span class="sw t-data">{STATE_LABEL[state]}</span>
    </span>
  );
}

/** The price rides on the button: Import and extract always extracts, one
 *  model call per source, so a separate chip would repeat the count. */
function Spend({ n }: { n: number }) {
  return <span class="spend"><IconSparkles size={12} stroke={1.75} aria-hidden />{n}</span>;
}

function Edu({ children }: { children: preact.ComponentChildren }) {
  return <p class="edu t-prose dim"><IconInfoCircle size={12} stroke={1.75} aria-hidden /><span>{children}</span></p>;
}

interface Chat { id: string; name?: string; mode?: string }

const openRow = signal<string | null>(null);
const railView = signal<"pending" | "imported" | "all">("pending");

/** Same collapse vocabulary as the review queue: a chevron in the control
 *  column, and a collapsed group keeps its header and its count so the
 *  collapsed state is still informative. Persisted per view, because these
 *  groups run to ninety rows and re-collapsing them every visit is a chore. */
const COLLAPSE_KEY = "mc-ltm-sources-collapsed";
const collapsedGroups = signal<Set<string>>(
  new Set(JSON.parse(localStorage.getItem(COLLAPSE_KEY) ?? "[]") as string[]),
);
function toggleGroupCollapsed(id: string) {
  const next = new Set(collapsedGroups.value);
  next.has(id) ? next.delete(id) : next.add(id);
  collapsedGroups.value = next;
  localStorage.setItem(COLLAPSE_KEY, JSON.stringify([...next]));
}

export function Sources() {
  const [previews, setPreviews] = useState<Map<SourceKind, ImportPreview>>(new Map());
  const [errors, setErrors] = useState<Map<SourceKind, string>>(new Map());
  const [notes, setNotes] = useState<Note[]>([]);
  const [review, setReview] = useState<Awaited<ReturnType<typeof fetchReview>> | null>(null);
  const [chats, setChats] = useState<Chat[]>([]);
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [job, setJob] = useState<{ done: number; total: number; stopped?: boolean } | null>(null);
  const [results, setResults] = useState<ImportResult[] | null>(null);
  const [confirmN, setConfirmN] = useState<number | null>(null);
  const stopRef = useState<{ v: boolean }>({ v: false })[0];

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
  }, [scopeChatId.value]);

  const rows = useMemo(() => buildSources(previews, review, notes), [previews, review, notes]);
  const { pending, imported, all } = partition(rows);
  const blockedDrafts = useMemo(
    () => (review?.sources ?? []).flatMap((s) => s.drafts.filter((d) => d.blockReasons.length)),
    [review]);

  const view = railView.value === "pending" ? pending : railView.value === "imported" ? imported : all;
  const needle = q.trim().toLowerCase();
  const shown = needle ? view.filter((r) => r.title.toLowerCase().includes(needle)) : view;

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
        if (scopeChatId.value) body.chatId = scopeChatId.value;
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
    <div class="audit"><div class="audit-list">
      <header class="console">
        <ScopeBar chats={chats} />
        <div class="sbar">
          <label class="sinput">
            <IconSearch size={14} stroke={1.75} aria-hidden />
            <input class="t-prose" placeholder="Search sources" value={q}
              onInput={(e) => setQ(e.currentTarget.value)} aria-label="Search sources" />
          </label>
        </div>
        <div class="qrail">
          <RailChip id="pending" label={OURS.sourcesPending} n={pending.length} />
          <RailChip id="imported" label={t("sourcesworkspace.alreadyImported")} n={imported.length} />
          <RailChip id="all" label="All" n={all.length} />
          {blockedDrafts.length > 0 && (
            <>
              <span class="qsp" />
              <a class="qchip qblock" href="#/memory/review">
                {OURS.sourcesBlocked} <b>{blockedDrafts.length} {t("reviewqueue.draft").toLowerCase()}s</b>
              </a>
            </>
          )}
        </div>
      </header>

      <main class="rows mem-rows">
        {results && <ImportReport results={results} onDismiss={() => setResults(null)} />}
        {job && <JobDock job={job} onStop={() => { stopRef.v = true; }}
          onResume={(rest) => void runImport(rest)} rest={selectedRows.slice(job.done)} />}

        {loading && <p class="empty">{t("sourcesworkspace.loadingSourcePreview")}</p>}
        {!loading && shown.length === 0 && <EmptyState q={q} rows={rows} view={railView.value} chats={chats} />}

        {!loading && KINDS.flatMap(({ id, label, icon: KI, bulk }) => {
          const inKind = shown.filter((r) => r.kind === id);
          const err = errors.get(id);
          if (err) return [<div key={id} class="mem-card is-danger"><b class="t-prose">{label()}</b><p class="t-data dim">{err}</p></div>];
          if (!inKind.length) return [];
          // Lorebook entries list under their book; everything else under its kind.
          const names = id === "lorebooks"
            ? [...new Set(inKind.map((r) => r.group))]
            : [""];
          return names.map((gname) => {
          const group = gname ? inKind.filter((r) => r.group === gname) : inKind;
          const heading = gname || label();
          const gid = id + "/" + gname;
          const collapsed = collapsedGroups.value.has(gid);
          const eligible = group.filter(isSelectable);
          const allPicked = eligible.length > 0 && eligible.every((r) => selected.has(r.sourceId));
          return (
            <div key={id + gname}>
              <div class="sghead">
                <button class="gexp hit" aria-expanded={!collapsed}
                  aria-label={`${collapsed ? "Expand" : "Collapse"} ${heading} (${group.length})`}
                  onClick={() => toggleGroupCollapsed(gid)}>
                  {collapsed ? <IconChevronRight size={15} stroke={1.75} aria-hidden />
                             : <IconChevronDown size={15} stroke={1.75} aria-hidden />}
                </button>
                <span class="ki"><KI size={15} stroke={1.75} aria-hidden /></span>
                <span class="gname t-prose">{heading}</span>
                <span class="gn t-data">{group.length}</span>
                <span class="gsp" />
                {bulk && eligible.length > 0 && (
                  <button class="gact hit" aria-pressed={allPicked}
                    onClick={() => setSelected((prev) => {
                      const n = new Set(prev);
                      if (allPicked) eligible.forEach((r) => n.delete(r.sourceId));
                      else eligible.forEach((r) => n.add(r.sourceId));
                      return n;
                    })}>
                    {allPicked ? "Clear" : `Select all ${eligible.length}`}
                  </button>
                )}
                {!bulk && <span class="gact-note t-data dim">{OURS.sourcesReviewEach}</span>}
              </div>
              {!collapsed && group.map((r) => (
                <SourceLine key={r.sourceId} row={r} bulk={bulk}
                  selected={selected.has(r.sourceId)} onToggle={() => toggle(r.sourceId)}
                  onReload={load} />
              ))}
            </div>
          );
          });
        })}

        {!loading && shown.length > 0 && (
          <p class="trunc t-data"><IconInfoCircle size={12} stroke={1.75} aria-hidden />
            <span>{t("sourcesworkspace.selectUpTo100SourceParts")}</span></p>
        )}
      </main>

      {selected.size > 0 && !job && (
        <div class="apply-dock">
          <span class="gsp" />
          <button class="dock-primary t-label" onClick={() => start(selectedRows)}>
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
  return (
    <button class="qchip hit" aria-pressed={railView.value === id} onClick={() => { railView.value = id; }}>
      {label} <b>{n}</b>
    </button>
  );
}

function ScopeBar({ chats }: { chats: Chat[] }) {
  const current = chats.find((c) => c.id === scopeChatId.value);
  return (
    <div class="scopebar">
      <label class="scopelab t-label t-label-s" for="scope-sel">{t("sourcesworkspace.importScope")}</label>
      <select id="scope-sel" class="scopesel t-prose" value={scopeChatId.value}
        onChange={(e) => setScope(e.currentTarget.value)}>
        <option value="">{t("sourcesworkspace.allChats")}</option>
        {chats.map((c) => <option key={c.id} value={c.id}>{c.name ?? c.id}</option>)}
      </select>
      <span class="gsp" />
      <span class="scopehint t-data dim">
        <IconInfoCircle size={12} stroke={1.75} aria-hidden />
        <span>{t("sourcesworkspace.limitImportsToThisChatAndItsRelatedScope")}</span>
      </span>
      {current && <span class="sr-only">Scoped to {current.name ?? current.id}</span>}
    </div>
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
  const open = openRow.value === row.sourceId;
  const KI = row.kind === "lorebooks" ? IconBook2 : row.kind === "chats" ? IconMessageCircle : IconUser;
  return (
    <>
      <div class={`srow ${selected ? "is-sel" : ""} ${open ? "is-open" : ""}`}>
        {bulk && (
          <button class={`sbox hit ${selected ? "on" : ""}`} role="checkbox" aria-checked={selected}
            aria-label={`Select ${row.title}`} disabled={!isSelectable(row)} onClick={onToggle}>
            {selected && <IconCheck size={12} stroke={2.5} aria-hidden />}
          </button>
        )}
        {expandable && (
          <button class="xchev hit" aria-expanded={open} aria-label={open ? "Collapse" : "Expand"}
            onClick={() => { openRow.value = open ? null : row.sourceId; }}>
            {open ? <IconChevronDown size={13} stroke={1.75} aria-hidden />
                  : <IconChevronRight size={13} stroke={1.75} aria-hidden />}
          </button>
        )}
        <span class="ki"><KI size={14} stroke={1.75} aria-hidden /></span>
        <span class="stitle t-prose">{row.title}</span>
        <StateMark state={row.state} />
        {row.kind === "lorebooks" && (
          <button class="jumpb hit" aria-label={`Open ${row.title} in Lorebooks`}
            onClick={() => navigate("lorebooks")}>
            <IconExternalLink size={14} stroke={1.75} aria-hidden />
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
    <div class="xbody">
      <div class="z-eye t-label t-label-s">
        <span class="z-lab">{t("memoryvault.memoriesCreatedFromThisSource")}</span>
        <span class="zcount t-data">{row.derived.length}</span>
      </div>
      <div class="memlist">
        {head.map((m) => (
          <div key={m.id} class="mrow2">
            <TypeIcon type={m.type} size={13} />
            <span class="stitle t-prose">{m.title}</span>
          </div>
        ))}
        {row.derived.length > 3 && !showAll && (
          <button class="fold-btn t-data hit" onClick={() => setShowAll(true)}>
            <IconChevronRight size={12} stroke={1.75} aria-hidden /> {row.derived.length - 3} more
          </button>
        )}
        {row.derived.length === 0 && <p class="t-prose dim">{t("sourcesworkspace.noSourcesHaveBeenImportedInThisScope")}</p>}
      </div>
      <div class={`pendrow ${row.pending ? "" : "is-quiet"}`}>
        {row.pending
          ? <IconCircleDashed size={14} stroke={1.75} aria-hidden />
          : <IconCircleCheck class="s-ok" size={14} stroke={1.75} aria-hidden />}
        <span class="t-prose">
          {row.pending
            ? `${row.pending} proposed memories await review`
            : t("reviewqueue.noProposedMemoriesAwaitReviewForSource")}
        </span>
        <span class="gsp" />
        {row.pending > 0 && row.noteId && (
          <button class="action-sec hit" onClick={() => { focusSource(row.noteId!); navigate("memory/review"); }}>
            {t("longtermmemorydetail.openReviewQueue")} <IconArrowRight size={12} stroke={1.75} aria-hidden />
          </button>
        )}
      </div>
    </div>
  );
}

// ── curate: read the extraction text, edit it, import it ────────────
const overrides = signal<Map<string, string>>(new Map());

function CuratePanel({ row, onImported }: { row: SourceRow; onImported: () => Promise<void> }) {
  const stored = overrides.value.get(row.sourceId) ?? row.snippet;
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(stored);
  const [busy, setBusy] = useState(false);
  const edited = overrides.value.has(row.sourceId);

  const save = () => {
    if (!draft.trim()) { toast(t("reviewqueue.sectionTextCannotBeEmpty"), { kind: "error" }); return; }
    const next = new Map(overrides.value);
    next.set(row.sourceId, draft);
    overrides.value = next;
    setEditing(false);
  };

  const importOne = async () => {
    setBusy(true);
    try {
      const body: Record<string, unknown> = { source: row.kind, sourceIds: [row.sourceId], extract: true };
      if (scopeChatId.value) body.chatId = scopeChatId.value;
      await importSourceNotes(body);
      toast(t("sourcesworkspace.sourceImportComplete"));
      openRow.value = null;
      await onImported();
    } catch (error) {
      toast((error as Error).message, { kind: "error" });
    }
    setBusy(false);
  };

  return (
    <div class="xbody">
      <div class={`zone ${editing ? "is-editing" : ""}`}>
        <div class="z-eye t-label t-label-s">
          <span class="z-lab">{OURS.extractionText}{editing ? " · editing" : ""}</span>
          {!editing && (
            <button class="zbtn hit" onClick={() => { setDraft(stored); setEditing(true); }}>
              <IconPencil size={12} stroke={1.75} aria-hidden /> {t("longtermmemorydetail.reviewEdit").toLowerCase()}
            </button>
          )}
        </div>
        {editing
          ? <textarea class="editarea t-prose" rows={Math.min(10, Math.max(3, Math.ceil(draft.length / 60)))}
              value={draft} onInput={(e) => setDraft(e.currentTarget.value)} />
          : <div class="t-prose xtext">{stored}</div>}
        <div class="z-foot t-data dim">{(editing ? draft : stored).length.toLocaleString()} ch</div>
      </div>
      {!editing && <Edu>This is the text the extractor will read. Editing it does not change the chat's own summary.</Edu>}
      <div class="curbar">
        {editing ? (
          <>
            <button class="dbtn2 save-on hit" onClick={save}>{t("memoryvault.save").toLowerCase()}</button>
            <button class="dbtn2 hit" onClick={() => setEditing(false)}>{t("memorysettings.discardChanges").toLowerCase()}</button>
            <span class="gsp" />
            <span class="barnote t-data">used the next time this source is extracted</span>
          </>
        ) : (
          <>
            <button class="dbtn2 keepish hit" disabled={busy} onClick={() => void importOne()}>
              <IconCheck size={15} stroke={1.75} aria-hidden />
              {busy ? t("sourcesworkspace.savingAndExtracting", { count: 1 }) : t("sourcesworkspace.importValue1", { value1: "" }).trim()}
              {!busy && <Spend n={1} />}
            </button>
            <span class="gsp" />
            {edited && <span class="dirty t-data"><IconPencil size={12} stroke={1.75} aria-hidden />edited</span>}
            <button class="dbtn2 hit" onClick={() => { openRow.value = null; }}>Skip</button>
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
      <div class="idock jobdock">
        <div class="jobline">
          <span class="dcount t-data">Stopped · {job.done} of {job.total} imported</span>
          <span class="gsp" />
          {rest.length > 0 && (
            <button class="dock-primary t-label" onClick={() => onResume(rest)}>
              {t("sourcesworkspace.importSelected_7fb57e8")} <Spend n={rest.length} />
            </button>
          )}
        </div>
      </div>
    );
  }
  return (
    <div class="idock jobdock" role="status" aria-live="polite">
      <div class="jobline">
        <span class="dcount t-data">
          {t("sourcesworkspace.savingAndExtracting", { count: job.total })} {job.done} / {job.total}
        </span>
        <span class="gsp" />
        <button class="action-sec hit" onClick={onStop}>Stop</button>
      </div>
      <span class="jbar"><i style={`width:${Math.round((job.done / Math.max(1, job.total)) * 100)}%`} /></span>
      <p class="jobnote t-data dim">
        <IconInfoCircle size={12} stroke={1.75} aria-hidden />
        <span>Stop keeps the sources that have already finished and leaves the rest unprocessed.</span>
      </p>
    </div>
  );
}

// ── the confirm, above the threshold only ───────────────────────────
function ConfirmSheet({ n, chats, onCancel, onGo }: {
  n: number; chats: Chat[]; onCancel: () => void; onGo: () => void;
}) {
  const scope = chats.find((c) => c.id === scopeChatId.value);
  return (
    <div class="peek-scrim" onClick={onCancel}>
      <aside class="csheet" role="dialog" aria-modal="true" aria-label="Confirm import" onClick={(e) => e.stopPropagation()}>
        <div class="chead"><IconSparkles size={16} stroke={1.75} aria-hidden />
          <b class="t-prose">{t("sourcesworkspace.importValue1", { value1: String(n) })}?</b></div>
        <div class="cbody">
          <div class="crow"><span class="ck t-label t-label-s">extraction</span>
            <span class="t-prose">{t("sourcesworkspace.savingAndExtracting", { count: n })} one model call each</span></div>
          <div class="crow"><span class="ck t-label t-label-s">scope</span>
            <span class="t-prose">{scope ? (scope.name ?? scope.id) : t("sourcesworkspace.allChats")}</span></div>
          <div class="crow"><span class="ck t-label t-label-s">after</span>
            <span class="t-prose">{t("sourcesworkspace.importExplanation")}</span></div>
        </div>
        <div class="cfoot">
          <button class="dock-primary t-label" onClick={onGo}>
            {t("sourcesworkspace.importSelected_7fb57e8")} <Spend n={n} />
          </button>
          <button class="action-sec hit" onClick={onCancel}>{t("memorysettings.cancel") || "Cancel"}</button>
        </div>
      </aside>
    </div>
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
    <div class="mem-card resultcard">
      <div class="reshead2">
        <IconCircleCheck class="s-ok" size={17} stroke={1.75} aria-hidden />
        <div>
          <div class="restitle t-prose">{t("sourcesworkspace.sourceImportComplete")}</div>
          <div class="ressub t-prose dim">
            {ok.length} of {rows.length} sources · {kept} proposed memories ready to review.
          </div>
        </div>
        <span class="gsp" />
        <button class="icon-btn hit" aria-label="Dismiss report" onClick={onDismiss}>×</button>
      </div>

      {bad.map((r) => (
        <div key={r.title} class="failblock">
          <div class="failhead"><IconAlertTriangle size={15} stroke={1.75} aria-hidden />
            <span class="failname t-prose">{r.title}</span></div>
          <p class="failwhy t-prose dim">{t("sourcesworkspace.sourceSavedExtractionFailed")}</p>
        </div>
      ))}

      {ok.length > 0 && (
        <>
          <button class="fold-btn t-data hit" aria-expanded={openDetail} onClick={() => setOpenDetail(!openDetail)}>
            {openDetail ? <IconChevronDown size={12} stroke={1.75} aria-hidden /> : <IconChevronRight size={12} stroke={1.75} aria-hidden />}
            Per-source detail
          </button>
          {openDetail && (
            <div class="rtable">
              <div class="rhead t-label t-label-s"><span>source</span>
                <span class="rnum">kept</span><span class="rnum">rejected</span></div>
              {ok.map((r) => (
                <div key={r.title} class="rrow t-prose">
                  <span class="rname"><span>{r.title}</span></span>
                  <span class="rnum t-data">{r.kept}</span>
                  <span class={`rnum t-data ${r.rejected ? "" : "zero"}`}>{r.rejected || "—"}</span>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      <div class="resfoot">
        <button class="dock-primary t-label" onClick={() => navigate("memory/review")}>
          {t("longtermmemorydetail.openReviewQueue")} <IconArrowRight size={13} stroke={1.75} aria-hidden />
        </button>
      </div>
      <Edu>{t("sourcesworkspace.importExplanation")}</Edu>
    </div>
  );
}

// ── nothing to show, and why ────────────────────────────────────────
function EmptyState({ q, rows, view, chats }: {
  q: string; rows: SourceRow[]; view: "pending" | "imported" | "all"; chats: Chat[];
}) {
  const scoped = Boolean(scopeChatId.value);
  const scopeName = chats.find((c) => c.id === scopeChatId.value)?.name ?? "this chat";

  if (q.trim()) {
    return (
      <div class="emptypane">
        <span class="emptyi"><IconSearch size={22} stroke={1.75} aria-hidden /></span>
        <div class="emptytitle t-prose">{t("memoryvault.noMatchingChats")}</div>
        <p class="emptybody t-prose dim">
          The search <b>{q.trim()}</b> matches nothing{scoped ? <> in <b>{scopeName}</b></> : null}.
          {" "}Clearing it would show {rows.length} sources.
        </p>
      </div>
    );
  }
  if (rows.length === 0 && scoped) {
    return (
      <div class="emptypane">
        <span class="emptyi"><IconBook2 size={22} stroke={1.75} aria-hidden /></span>
        <div class="emptytitle t-prose">{t("sourcesworkspace.noLorebooksAreAvailableInThisScope")}</div>
        <p class="emptybody t-prose dim">Widening the import scope will show sources from other chats.</p>
        <div class="emptyact"><button class="action-sec hit" onClick={() => setScope("")}>
          {t("sourcesworkspace.importScope")}: {t("sourcesworkspace.allChats")}</button></div>
      </div>
    );
  }
  // the default view is a filter that empties as the reviewer succeeds
  return (
    <div class="emptypane">
      <span class="emptyi s-ok"><IconCircleCheck size={22} stroke={1.75} aria-hidden /></span>
      <div class="emptytitle t-prose">
        {view === "pending" ? "No sources are waiting to be imported." : t("sourcesworkspace.noSourcesHaveBeenImportedInThisScope")}
      </div>
      <p class="emptybody t-prose dim">
        {view === "pending"
          ? "New chat summaries will appear here as they are written."
          : "Import a source to see it here."}
      </p>
      {view === "pending" && (
        <div class="emptyact">
          <button class="dock-primary t-label" onClick={() => navigate("memory/review")}>
            {t("longtermmemorydetail.openReviewQueue")}
          </button>
        </div>
      )}
    </div>
  );
}
