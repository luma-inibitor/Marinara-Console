// The limits a memory is held to.
//
// These mirror the engine's schema, but they are not facts about the wire — a
// payload never carries them, and nothing in `api/` reads them. They are rules
// about what a note may hold, which makes them the model's business.

/** ltmSectionSchema text max. A section sitting exactly on it is full rather
 *  than over; every reading of the cap in this tool draws the line there. */
export const SECTION_CAP = 20000;

/** Max length of ONE keyword array. The engine caps its derived, manual and
 *  suppressed lists separately, so a person fills this against the manual list
 *  alone and the merged list may hold more; `keywords.ts` does the splitting. */
export const KEYWORD_CAP = 30;

/** A second, independent cap: how many of the MERGED keywords the engine will
 *  index for recall. Same number as `KEYWORD_CAP` and not the same rule — that
 *  one refuses a write, this one silently drops the overflow. */
export const INDEXED_KEYWORD_CAP = 30;
