// Long-Term Memory tool shell: Review Queue / Memory Vault / Sources, with
// the package's own navigation vocabulary. Routes: #/memory/review|vault|sources.

import { useEffect } from "preact/hooks";
import { navigate } from "../../shell/router";
import { ltmStatus, rebuildIndexes, type LtmStatus } from "./data";
import { signal } from "@preact/signals";
import { VIEW_ICON } from "../../ui/icons";
import { ScopeBar, useScopeData } from "./ScopeBar";
import { toast } from "../../shell/toast";
import { t, tAny } from "../../copy";
import { Review } from "./Review";
import { Vault } from "./Vault";
import { Sources } from "./Sources";
import { NotePeek } from "./NotePeek";
import { Copy } from "./Copy";
import { activeFacets, pendingSources, review } from "./store";

const status = signal<LtmStatus | null>(null);
const statusFailed = signal(false);
const rebuilding = signal(false);

export async function refreshLtmStatus() {
  try {
    status.value = await ltmStatus();
    statusFailed.value = false;
  } catch {
    statusFailed.value = true;
  }
}

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

  const s = status.value;
  const health = s?.indexes.health;
  const unhealthy = Boolean(s && health !== "healthy" && health !== "not_built");
  const noEmbeddings = Boolean(s && !s.indexes.embeddingsAvailable);
  const runRebuild = async () => {
    rebuilding.value = true;
    try {
      await rebuildIndexes();
      await refreshLtmStatus();
      toast(t("longtermmemorydetail.reindexComplete"));
    } catch (error) {
      toast((error as Error).message, { kind: "error" });
    }
    rebuilding.value = false;
  };
  return (
    <div className="memory-tool">
      {/* Scope above the views: it decides what every view shows. */}
      <ScopeBar chats={chats} characters={characters} />
      <nav className="mem-nav" aria-label={t("longtermmemorynavigation.longTermMemorySections")}>
        {VIEWS.map((id) => {
          const I = VIEW_ICON[id];
          const count = id === "review" ? (review.value?.counts.mutations ?? s?.notes.pendingDrafts ?? 0)
            : id === "vault" ? (s?.notes.savedMemories ?? 0)
            : (pendingSources.value ?? 0);
          return (
            <button key={id} className="mem-tab t-label" aria-current={view === id ? "page" : undefined}
              onClick={() => { if (id === "review") activeFacets.value = new Map(); navigate(`memory/${id}`); }}>
              <I size={15} stroke={1.75} aria-hidden />
              {tAny(`memory.nav.${id}`)}
              {count > 0 && <b className="mem-badge t-data">{count}</b>}
            </button>
          );
        })}
        {statusFailed.value && <span className="mem-status t-data is-drop">{t("longtermmemorydetail.statusUnavailable")}</span>}
      </nav>
      {(unhealthy || noEmbeddings) && (
        <div className="health-banner">
          <span className="t-prose">
            {unhealthy && <><Copy k="memory.index.unhealthy" slots={{ state: <b>{health!.replaceAll("_", " ")}</b> }} />{" "}</>}
            {noEmbeddings && t("memory.index.noEmbeddings")}
          </span>
          {unhealthy && (
            <button className="action-sec t-label" disabled={rebuilding.value} onClick={() => void runRebuild()}>
              {rebuilding.value ? t("memory.index.rebuilding") : t("activityview.phaseRebuild")}
            </button>
          )}
        </div>
      )}
      {view === "review" && <Review />}
      {view === "vault" && <Vault />}
      {view === "sources" && <Sources />}
      <NotePeek />
    </div>
  );
}
