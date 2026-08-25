// Owns the sources workspace: the importable rows, the per-kind load errors,
// the chats scope names them under, and the import itself. One owner, so the
// screen never holds its own copy of a record and never issues its own request.
//
// The rows are assembled from three places (see `model/sources.ts`), so this
// module reads the review response as well as the previews. That response is
// really the review queue's record — see `loadSources` for why it is fetched
// here rather than taken from `store/review.ts`.
//
// Actions throw or report through their callbacks; the copy for a toast
// belongs to the screen, and importing `shell/toast` here would point upward.

import { createStore } from "../../../lib/store";
import type { Chat, ImportPreview, ImportResult, ReviewResponse } from "../api/types";
import { fetchChats } from "../api/chats";
import { fetchReview } from "../api/drafts";
import { importPreview, importSourceNotes } from "../api/import";
import { buildSources, type SourceKind, type SourceRow } from "../model/sources";
import { loadAllNotes } from "./notes";
import { scopeChatId } from "./scope";

export type { Chat };

/** A draft the engine is holding back, with the reason it gave. */
type BlockedDraft = ReviewResponse["sources"][number]["drafts"][number];

// The registry keys its source kinds by the engine's singular names; these are
// the plural bucket names the model and the screen speak, and the preview is
// fetched once per bucket.
const KIND_IDS: SourceKind[] = ["lorebooks", "chats", "characters"];

export const sourceRows = createStore<SourceRow[]>([]);
/** Keyed by kind: a preview that failed takes its own group down and leaves
 *  the other two listing normally. */
export const sourceErrors = createStore<Map<SourceKind, string>>(new Map());
export const sourcesLoading = createStore(true);
export const blockedDrafts = createStore<BlockedDraft[]>([]);
export const chats = createStore<Chat[]>([]);

// Owns the count the Sources screen publishes for the nav badge.
//
// The Sources screen writes this store directly, and that is legitimate: it is
// view state, a figure one screen computes for another to display, not entity
// state whose change has to reach the server and recompute anything. A layer
// check that forbids screens writing entity stores should not read this as a
// violation.

/** Sources ready to import, in the current scope. The nav badge reads this,
 *  and every nav badge must mean "waiting" — a badge counting work already
 *  done would give the same channel two opposite meanings. Null until the
 *  Sources screen has computed it once. */
export const readySources = createStore<number | null>(null);

/** Load every source kind's preview, the notes they produced, and the review
 *  queue's take on them, then assemble the rows.
 *
 *  `fetchReview` is the review queue's record, not this workspace's, and the
 *  owner of it is `store/review.ts`. Its `refresh()` is not reusable here: it
 *  also consumes the focus handoff below, overwrites `notesById`, and prunes
 *  the decision ledger. Sharing the record properly needs a side-effect-free
 *  `ensureReview` on that module. */
export async function loadSources(): Promise<void> {
  sourcesLoading.set(true);
  const next = new Map<SourceKind, ImportPreview>();
  const errs = new Map<SourceKind, string>();
  await Promise.all(KIND_IDS.map(async (id) => {
    try { next.set(id, await importPreview(id)); }
    catch (error) { errs.set(id, (error as Error).message); }
  }));
  sourceErrors.set(errs);
  const notes = await loadAllNotes();
  let review: ReviewResponse | null = null;
  try { review = await fetchReview(); } catch { review = null; }
  sourceRows.set(buildSources(next, review, notes));
  blockedDrafts.set((review?.sources ?? []).flatMap((s) => s.drafts.filter((d) => d.blockReasons.length)));
  sourcesLoading.set(false);
}

/** The chats scope can name. Failure leaves the list empty rather than
 *  throwing: a scope picker with no names is still a usable screen. */
export async function loadChats(): Promise<void> {
  try { chats.set(await fetchChats()); }
  catch { chats.set([]); }
}

/** Import one source and extract from it — one model call, and a write to the
 *  engine. The scoped chat rides along when there is one, because the engine
 *  records it into the extraction context. */
export function importSource(row: SourceRow): Promise<ImportResult> {
  const body: Record<string, unknown> = { source: row.kind, sourceIds: [row.sourceId], extract: true };
  if (scopeChatId.get()) body.chatId = scopeChatId.get();
  return importSourceNotes(body);
}

/** Import a batch, one source at a time so a failure costs only its own row
 *  and the caller can stop between them. Reports progress and per-row failure
 *  through callbacks — the screen owns the dock and the toast copy. A stopped
 *  run still returns what it managed, so the report covers it. */
export async function importSources(batch: SourceRow[], hooks: {
  shouldStop?: () => boolean;
  /** `stopped` marks the last report of a run the caller halted, so the dock
   *  can say where it got to rather than where it was going. */
  onProgress?: (done: number, total: number, stopped: boolean) => void;
  onError?: (row: SourceRow, error: Error) => void;
} = {}): Promise<{ results: ImportResult[]; stopped: boolean }> {
  const results: ImportResult[] = [];
  for (const [i, row] of batch.entries()) {
    if (hooks.shouldStop?.()) {
      hooks.onProgress?.(i, batch.length, true);
      return { results, stopped: true };
    }
    hooks.onProgress?.(i, batch.length, false);
    try {
      results.push(await importSource(row));
    } catch (error) {
      // A failed row is still a row in the report: the source was saved even
      // when the extraction was not.
      results.push({ batchStatus: "failed", source: row.kind, imported: [{ sourceId: row.sourceId, title: row.title }] } as ImportResult);
      hooks.onError?.(row, error as Error);
    }
  }
  return { results, stopped: false };
}

// Sources → Review handoff, so neither screen imports the other. In memory,
// not sessionStorage: a key that outlived a reload would re-filter the queue.
let pendingFocus: string | null = null;

/** Arm the queue to land pre-filtered to one source note. */
export function focusSource(sourceNoteId: string) {
  pendingFocus = sourceNoteId;
}

/** Take the armed source note id, if any, and disarm. */
export function consumeFocusSource(): string | null {
  const id = pendingFocus;
  pendingFocus = null;
  return id;
}
