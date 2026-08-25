// The limits a memory is held to.
//
// These mirror the engine's schema, but they are not facts about the wire — a
// payload never carries them, and nothing in `api/` reads them. They are rules
// about what a note may hold, which makes them the model's business.

/** ltmSectionSchema text max. A section sitting exactly on it is full rather
 *  than over; every reading of the cap in this tool draws the line there. */
export const SECTION_CAP = 20000;

/** Note keywords max. */
export const KEYWORD_CAP = 30;
