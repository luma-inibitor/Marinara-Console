// Long-Term Memory tool shell: Review Queue / Memory Vault / Sources, with
// the package's own navigation vocabulary. Routes: #/memory/review|vault|sources.

import { useEffect, useMemo } from "react";
import { navigate } from "../../shell/router";
import { VIEW_ICON } from "../../ui/icons";
import { ScopeBar } from "./ScopeBar";
import { toast } from "../../shell/toast";
import { t, tAny } from "../../copy";
import { Review } from "./Review";
import { Vault } from "./Vault";
import { Sources } from "./Sources";
import { NotePeek } from "./NotePeek";
import { Copy } from "./Copy";
import { review, rows } from "./store/review";
import { notesById } from "./store/notes";
import { pendingSources } from "./store/sources";
import { activeFacets } from "./store/view";
import { listedInVault } from "./model/listing";
import { noteInScope } from "./model/scope";
import { useScope, useScopeData } from "./store/scope";
import { rebuildIndexes, rebuilding, refreshLtmStatus, status, statusFailed } from "./store/status";
import { useStore } from "../../lib/store";

/** Sources → Review handoff: land on the queue pre-filtered to one source. */
let pendingFocusSource: string | null = null;
export function focusSource(sourceNoteId: string) {
  pendingFocusSource = sourceNoteId;
}
function consumeFocusSource(): string | null {
  const v = pendingFocusSource;
  pendingFocusSource = null;
  return v;
}

// One-word labels, so the targets fit a phone without truncating. The order is
// the workflow: material arrives in Sources, gets decided in Review, and lands
// in the Vault. Review is the default landing view because it is the work.
const VIEWS = ["sources", "review", "vault"] as const;

export function MemoryTool({ rest }: { rest: string[] }) {
  const view = (VIEWS as readonly string[]).includes(rest[0]) ? rest[0] : "review";
  const { chats, characters } = useScopeData();
  const s = useStore(status);
  const failed = useStore(statusFailed);
  const isRebuilding = useStore(rebuilding);
  const reviewData = useStore(review);
  const pending = useStore(pendingSources);
  const scope = useScope();
  const scopedRows = useStore(rows); // already narrowed to scope by the store
  const loadedNotes = useStore(notesById);
  const listedMemories = useMemo(
    () => [...loadedNotes.values()].filter((n) => n.type !== "source" && listedInVault(n) && noteInScope(n, scope)).length,
    // Scope is a fresh object each render, so depending on it would recompute
    // every time. Its two fields ARE the whole of it, and noteInScope reads
    // nothing else, so listing them covers the object exactly.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [loadedNotes, scope.characterId, scope.chatId]);

  useEffect(() => { void refreshLtmStatus(); }, [view]);

  // Consume a pending source focus when entering review.
  useEffect(() => {
    if (view !== "review") return;
    const src = consumeFocusSource();
    if (!src) return;
    // The review store facets by source *title*; store the id and let the
    // review refresh resolve it — a title may not be loaded yet.
    sessionStorage.setItem("mc-ltm-focus-source", src);
  }, [view]);

  const health = s?.indexes.health;
  const unhealthy = Boolean(s && health !== "healthy" && health !== "not_built");
  const noEmbeddings = Boolean(s && !s.indexes.embeddingsAvailable);
  const runRebuild = async () => {
    try {
      await rebuildIndexes();
      toast(t("longtermmemorydetail.reindexComplete"));
    } catch (error) {
      toast((error as Error).message, { kind: "error" });
    }
  };
  return (
    <div className="memory-tool">
      {/* Scope above the views: it decides what every view shows. */}
      <ScopeBar chats={chats} characters={characters} />
      <nav className="mem-nav" aria-label={t("longtermmemorynavigation.longTermMemorySections")}>
        {VIEWS.map((id) => {
          const I = VIEW_ICON[id];
          // A badge names how much is behind the tab, so it counts what that
          // tab actually lists — the same records, through the same scope.
          //
          // The review badge reads the live row set rather than the response's
          // `counts.mutations`, which is a server total that also counts claims
          // held inside blocked drafts: it read 190 over a queue listing 77.
          // /status is likewise a server-wide aggregate that cannot see scope.
          // Both remain the fallback for the moment before anything has loaded,
          // where the alternative is a badge reading zero over a full vault.
          //
          // The vault badge reads the loaded notes whether or not a scope is
          // set, because the list drops archived memories and `savedMemories`
          // counts them: a server total is only close enough to the truth
          // before the records this tab lists have arrived.
          const count = id === "review" ? (reviewData ? scopedRows.length : s?.notes.pendingDrafts ?? 0)
            : id === "vault" ? (loadedNotes.size ? listedMemories : s?.notes.savedMemories ?? 0)
            : (pending ?? 0);
          return (
            <button key={id} className="mem-tab t-label" aria-current={view === id ? "page" : undefined}
              onClick={() => { if (id === "review") activeFacets.set(new Map()); navigate(`memory/${id}`); }}>
              <I size={15} stroke={1.75} aria-hidden />
              {tAny(`memory.nav.${id}`)}
              {count > 0 && <b className="mem-badge t-data">{count}</b>}
            </button>
          );
        })}
        {failed && <span className="mem-status t-data is-drop">{t("longtermmemorydetail.statusUnavailable")}</span>}
      </nav>
      {(unhealthy || noEmbeddings) && (
        <div className="health-banner">
          <span className="t-prose">
            {unhealthy && <><Copy k="memory.index.unhealthy" slots={{ state: <b>{health!.replaceAll("_", " ")}</b> }} />{" "}</>}
            {noEmbeddings && t("memory.index.noEmbeddings")}
          </span>
          {unhealthy && (
            <button className="action-sec t-label" disabled={isRebuilding} onClick={() => void runRebuild()}>
              {isRebuilding ? t("memory.index.rebuilding") : t("activityview.phaseRebuild")}
            </button>
          )}
        </div>
      )}
      {view === "review" && <Review />}
      {view === "vault" && <Vault noteId={rest[1]} />}
      {view === "sources" && <Sources />}
      <NotePeek />
    </div>
  );
}
