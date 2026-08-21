// Long-Term Memory tool shell: Review Queue / Memory Vault / Sources, with
// the package's own navigation vocabulary. Routes: #/memory/review|vault|sources.

import { useEffect } from "preact/hooks";
import { navigate } from "../../shell/router";
import { ltmStatus, rebuildIndexes, type LtmStatus } from "./data";
import { signal } from "@preact/signals";
import { toast } from "../../shell/toast";
import { t } from "./strings";
import { Review } from "./Review";
import { Vault } from "./Vault";
import { Sources } from "./Sources";
import { NotePeek } from "./NotePeek";
import { activeFacets, review } from "./store";

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
export function consumeFocusSource(): string | null {
  const v = pendingFocusSource;
  pendingFocusSource = null;
  return v;
}

const VIEWS = [
  { id: "review", label: () => t("longtermmemorynavigation.reviewQueue") },
  { id: "vault", label: () => t("longtermmemorynavigation.memoryVault") },
  { id: "sources", label: () => t("longtermmemorynavigation.sources") },
];

export function MemoryTool({ rest }: { rest: string[] }) {
  const view = VIEWS.some((v) => v.id === rest[0]) ? rest[0] : "review";

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
      toast("Recall index rebuilt");
    } catch (error) {
      toast((error as Error).message, { kind: "error" });
    }
    rebuilding.value = false;
  };
  return (
    <div class="memory-tool">
      <nav class="mem-nav" aria-label="Memory views">
        {VIEWS.map((v) => (
          <button key={v.id} class="mem-tab t-label" aria-current={view === v.id ? "page" : undefined}
            onClick={() => { if (v.id === "review") activeFacets.value = new Map(); navigate(`memory/${v.id}`); }}>
            {v.label()}
            {v.id === "review" && (review.value?.counts.mutations ?? s?.notes.pendingDrafts ?? 0) > 0 && (
              <b class="mem-badge t-data">{review.value?.counts.mutations ?? s?.notes.pendingDrafts}</b>
            )}
          </button>
        ))}
        {s ? (
          <span class="mem-status t-data" data-contrast-exempt>
            {s.notes.savedMemories} memories · {s.notes.sourceNotes} sources ·{" "}
            <span class={health === "healthy" ? "is-keep" : health === "not_built" ? "dim" : "is-drop"}>index {health!.replaceAll("_", " ")}</span>
          </span>
        ) : statusFailed.value ? (
          <span class="mem-status t-data is-drop">status unavailable</span>
        ) : null}
      </nav>
      {(unhealthy || noEmbeddings) && (
        <div class="health-banner">
          <span class="t-prose">
            {unhealthy && <>Recall index is <b>{health!.replaceAll("_", " ")}</b> — saved memories may not be searchable. </>}
            {noEmbeddings && <>Semantic recall is unavailable on this engine (no embedding model) — retrieval runs on keywords and text matching only.</>}
          </span>
          {unhealthy && (
            <button class="action-sec t-label" disabled={rebuilding.value} onClick={() => void runRebuild()}>
              {rebuilding.value ? "Rebuilding…" : "Rebuild"}
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
