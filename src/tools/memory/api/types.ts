// The shapes the engine puts on the wire.
//
// This is the endpoints layer's vocabulary: what a payload contains, not what
// the console makes of it. Row, SectionPressure and the rest are the console's
// own inventions and live in the model, not here.
//
// Every route in api/ exists in the package's routes.ts (long-term-memory
// 1.2.9); nothing engine-side is invented. Caps and section-additivity rules
// mirror the package schema and draft-projector — fidelity beats elegance. The
// caps themselves are rules rather than payload, and live in model/caps.ts.
//
// Every type here is inferred from the schema in schema.ts that checks it.

import type * as v from "valibot";
import type { AcceptResponseSchema, ConflictSchema, DISPOSITIONS, ExtractResponseSchema, ImportPreviewSchema, ImportResultSchema, LtmStatusSchema, MutationSchema, NoteArchiveSchema, NoteSchema, NoteSectionSchema, NOTE_TYPES, PreflightResponseSchema, ReviewChangeSchema, ReviewResponseSchema, SkipResponseSchema } from "./schema";

export type NoteType = (typeof NOTE_TYPES)[number];
export type Disposition = (typeof DISPOSITIONS)[number];

export type NoteSection = v.InferOutput<typeof NoteSectionSchema>;

/** `keywords` is what the engine derived, and is not the list the 30 cap is
 *  measured against; see model/keywords.ts. `manualKeywords` is absent, not
 *  empty, on notes written before the engine split the two arrays. */
export type Note = v.InferOutput<typeof NoteSchema>;

export type Conflict = v.InferOutput<typeof ConflictSchema>;

export type Mutation = v.InferOutput<typeof MutationSchema>;

export type ReviewChange = v.InferOutput<typeof ReviewChangeSchema>;

export type ReviewResponse = v.InferOutput<typeof ReviewResponseSchema>;

export type NoteArchive = v.InferOutput<typeof NoteArchiveSchema>;

export type ExtractResponse = v.InferOutput<typeof ExtractResponseSchema>;

export type PreflightResponse = v.InferOutput<typeof PreflightResponseSchema>;

export type AcceptResponse = v.InferOutput<typeof AcceptResponseSchema>;

export type SkipResponse = v.InferOutput<typeof SkipResponseSchema>;

export type LtmStatus = v.InferOutput<typeof LtmStatusSchema>;

export type ImportPreview = v.InferOutput<typeof ImportPreviewSchema>;

export type ImportResult = v.InferOutput<typeof ImportResultSchema>;
