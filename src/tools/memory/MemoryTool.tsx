// Long-Term Memory tool shell: Review Queue / Memory Vault / Sources, with
// the package's own navigation vocabulary. Routes: #/memory/review|vault|sources.

import { useEffect } from "preact/hooks";
import { navigate } from "../../shell/router";
import { ltmStatus } from "./data";
import { signal } from "@preact/signals";
import { t } from "./strings";
import { Review } from "./Review";
import { Vault } from "./Vault";
import { Sources } from "./Sources";
import { NotePeek } from "./NotePeek";
import { activeFacets, review } from "./store";

const status = signal<{ memories: number; sources: number; pending: number; health: string } | null>(null);

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

  useEffect(() => {
    ltmStatus()
      .then((s) => {
        status.value = {
          memories: s.notes.savedMemories,
          sources: s.notes.sourceNotes,
          pending: s.notes.pendingDrafts,
          health: s.indexes.health,
        };
      })
      .catch(() => { status.value = null; });
  }, [view]);

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
  return (
    <div class="memory-tool">
      <nav class="mem-nav" aria-label="Memory views">
        {VIEWS.map((v) => (
          <button key={v.id} class="mem-tab t-label" aria-current={view === v.id ? "page" : undefined}
            onClick={() => { if (v.id === "review") activeFacets.value = new Map(); navigate(`memory/${v.id}`); }}>
            {v.label()}
            {v.id === "review" && (review.value?.counts.mutations ?? s?.pending ?? 0) > 0 && (
              <b class="mem-badge t-data">{review.value?.counts.mutations ?? s?.pending}</b>
            )}
          </button>
        ))}
        {s && (
          <span class="mem-status t-data" data-contrast-exempt>
            {s.memories} memories · {s.sources} sources ·{" "}
            <span class={s.health === "healthy" ? "is-keep" : s.health === "not_built" ? "dim" : "is-drop"}>index {s.health.replaceAll("_", " ")}</span>
          </span>
        )}
      </nav>
      {view === "review" && <Review />}
      {view === "vault" && <Vault />}
      {view === "sources" && <Sources />}
      <NotePeek />
    </div>
  );
}
