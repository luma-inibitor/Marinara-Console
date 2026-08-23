// Copy policy: the long-term-memory package's own strings wherever an
// equivalent exists, so the console and the engine name the same things the
// same way (DESIGN.md §2). `ltm-en.json` is vendored verbatim from the package
// client (long-term-memory 1.2.9, Marinara-Agents d9b93fe). Words the product
// does not have live in OURS, each with a note.

import catalog from "./ltm-en.json";

const PREFIX = "ui.longTermMemory.";
const table = catalog as Record<string, unknown>;

/** Product string by catalog key (without the ui.longTermMemory. prefix). */
export function t(key: string, values?: Record<string, string | number>): string {
  const raw = table[PREFIX + key];
  if (typeof raw !== "string") {
    console.warn(`[ltm strings] missing product string: ${key}`);
    return key;
  }
  let s: string = raw;
  if (values) for (const [k, v] of Object.entries(values)) s = s.replaceAll(`{{${k}}}`, String(v));
  return s;
}

// ── Our copy, where the product has no word ─────────────────────────
// Tracked in the tool README section of DESIGN.md-adjacent docs; keep the
// vocabulary consistent with the ltm-review wireframes' deviations table.
export const OURS = {
  // Decision vocabulary. The product's Accept/Skip are immediate server
  // actions; keep/drop/undecided name a local judgment that is only
  // transmitted on Apply, which is a genuinely different thing.
  keep: "keep",
  drop: "drop",
  undecided: "undecided",
  // The commit's busy state. The catalog's reviewqueue.accepting ("Accepting...")
  // speaks the server vocabulary, but this button commits a local keep/drop
  // judgment and reads "Apply decided" at rest — the busy state must not switch
  // vocabularies mid-press.
  applying: "Applying…",
  // Result of a commit, in the local vocabulary. The catalog's
  // reviewqueue.skipped is "Proposals skipped" — Skip is the product's own
  // immediate server action, while this count is the reviewer's drops the
  // engine confirmed removed. Same number, our word for it.
  dropped: "Dropped",
  // Apply-dock forecast. The dock used to say drafts "will be sent", a fourth
  // verb for the commit beside keep/drop and Apply; the catalog only reports
  // per draft after the fact ("Applied") and has no forward-looking phrase to
  // borrow. Counts drafts, not claims.
  draftsWillApply: (n: number) => `${n} draft${n === 1 ? "" : "s"} will be applied`,
  // The product ships caps and a binary budget rejection, nothing for
  // approaching one; extended from its "Limits:" label.
  nearLimit: "near a limit",
  overLimit: "over the limit",
  // Restore-point framing over the product's existing backup export.
  restorePoint: "Take a restore point first",
  restorePointDone: "Restore point saved",
  // Facet-rail provenance headings (the review study's grouping).
  facetsComputed: "computed",
  facetsFromModel: "from the model",
  facetsYours: "yours",
  // Batch reporting: the product reports per draft; we report per batch.
  autoIncluded: (n: number) => `${n} added as dependencies`,
  // Empty queue: the product has no string for this state (its own empty
  // state names the Sources screen's condition).
  queueEmpty: "Nothing is waiting on review.",
  // Disposition names: schema values the product computes but never labels.
  disposition: { new: "new", merge: "merge", rewrite: "rewrite" } as Record<string, string>,
  // Detail-pane zone labels (v5). Anchored to catalog vocabulary: "preview"
  // and "evidence" from reviewqueue.evidenceAndPreview / previewUnavailable;
  // "existing"/"proposed" from reviewqueue.existingValue / proposedValue;
  // "new memory" from reviewqueue.newMemory; "extraction" from the
  // extractiondetails namespace. Lowercase because eyebrows uppercase in CSS.
  // Navigation labels. The catalog names these views in full ("Review queue",
  // "Memory Vault", "Sources"); the console's own nav uses one word each so the
  // four fit as equal targets on a phone without truncating. Owner's call,
  // 2026-08-22 — the full catalog names still head each screen.
  nav: { sources: "Sources", vault: "Vault", review: "Review", activity: "Activity" } as Record<string, string>,
  // Sources screen. The catalog covers the states (New / Already imported /
  // Update available / Context changed / Extraction incomplete) and the verbs
  // (Import and extract / Re-extract / Select all / Refresh). These four are
  // genuinely new concepts the product has no word for, so they are declared
  // here instead of being coined at the call site.
  sourcesPending: "Pending", // sources not yet imported; the catalog counts them but never labels the set
  sourcesBlocked: "Blocked", // drafts held before review; the catalog says "blocked" only inside sentences
  sourcesReviewEach: "Review each", // the per-kind affordance for sources that must be curated, not bulk-imported
  extractionText: "Extraction text", // the editable text extraction reads; the override is new to this console
  // The catalog has the whole family — "No matching chats/characters/branches/
  // personas/places" — but not sources, and the Sources search was borrowing
  // the chats one while its own body text said "sources". Same sentence shape,
  // right noun.
  noMatchingSources: "No matching sources.",
  zonePreview: "preview",
  zoneDiff: "existing → proposed",
  zoneEvidence: "evidence",
  zoneNewMemory: "new memory",
  zoneExtraction: "extraction",
  // The single reviewable item in the queue. The catalog has zero occurrences
  // of "claim" in any key or value: the product's vocabulary is a five-word
  // lifecycle — candidate (at extraction) → proposal / mutation (in review,
  // inside a draft) → suggestion (once rejected) — and none of those five names
  // the thing a reviewer holds one of. The console keeps "claim" because the
  // wire schema already does: `claimKind: "static" | "change"` on interface
  // Mutation (data.ts:40), so an object whose kind is a claimKind is a claim.
  // ClaimDetail.tsx is named for that field and glossary.tsx anchors the term
  // to it. Note "claim kind" itself is domain vocabulary, not a coinage — it
  // names the schema field verbatim. Only the bare noun is ours.
  claim: "claim",
  // The set of claims applied in one go, which may span drafts. Distinct from
  // "draft", which is the container the engine returns claims in and which the
  // catalog does have a word for. The product reports per draft; the console
  // reports per batch, and the catalog has no word for the user's own
  // apply-unit.
  batch: "batch",
  // The note sub-part. Unlike everything else in OURS, the product DOES have a
  // word for this and we are deliberately not using it: memoryvault renames the
  // sub-part to "detail" user-visibly (memoryvault.addSection = "Create detail",
  // newSection = "New detail", detailRequired = "Add at least one detail before
  // saving this memory.", detailNameExample = "e.g. Current state, Important
  // facts"), so "detail" there really does mean the sub-part, not a detail pane.
  // But the product contradicts itself: reviewqueue still says section
  // (addToSection = "Add to section", updateSection = "Update section",
  // sectionTextCannotBeEmpty). The schema and wire format do not contradict
  // themselves at all — `sections: Record<string, NoteSection>`, mutation kinds
  // `append_section` / `update_section`, `SECTION_CAP` (data.ts). The console
  // keeps "section" because it matches the schema, the wire format, and one of
  // the two product surfaces; memoryvault's "detail" is the outlier. Owner's
  // call — recorded here so the divergence is a decision, not a drift.
  section: "section",
  // Diff-zone eyebrow labels, rendered on their own as well as inside zoneDiff.
  // Derived from reviewqueue.existingValue ("Existing: {{value}}") and
  // proposedValue ("Proposed: {{value}}"), which are whole interpolated
  // sentences carrying the value — they cannot be used as bare labels, so the
  // catalog has no string for the label alone. Lowercase because eyebrows
  // uppercase in CSS, per the zonePreview / zoneEvidence convention above.
  existing: "existing",
  proposed: "proposed",
};
