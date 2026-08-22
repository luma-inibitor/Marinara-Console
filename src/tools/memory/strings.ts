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
  // Sources screen. The catalog covers the states (New / Already imported /
  // Update available / Context changed / Extraction incomplete) and the verbs
  // (Import and extract / Re-extract / Select all / Refresh). These four are
  // genuinely new concepts the product has no word for, so they are declared
  // here instead of being coined at the call site.
  sourcesPending: "Pending", // sources not yet imported; the catalog counts them but never labels the set
  sourcesBlocked: "Blocked", // drafts held before review; the catalog says "blocked" only inside sentences
  sourcesReviewEach: "Review each", // the per-kind affordance for sources that must be curated, not bulk-imported
  extractionText: "Extraction text", // the editable text extraction reads; the override is new to this console
  zonePreview: "preview",
  zoneDiff: "existing → proposed",
  zoneEvidence: "evidence",
  zoneNewMemory: "new memory",
  zoneExtraction: "extraction",
};
