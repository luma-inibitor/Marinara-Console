/* @copy-strict */
// The entry's enum labels: status and hint, and the position names at both
// densities.
//
// The copy TABLES below are enum -> label maps living in object initialisers,
// not rendered slots, so no position rule in design/copycheck.mjs reaches them.
// Hence the @copy-strict marker above: in a strict file EVERY string literal
// with a letter and a space is read as copy, so a label added to one of these
// maps without a catalog entry fails the check instead of shipping unnoticed.
// Do not drop the marker.
import { tAny } from "../../../copy";
import { STATUSES, type EntryStatus } from "./entry";

const byStatus = (key: (s: EntryStatus) => string): Record<EntryStatus, string> =>
  Object.fromEntries(STATUSES.map((s) => [s, tAny(key(s))])) as Record<EntryStatus, string>;

export const STATUS_LABEL = byStatus((s) => `lorebooks.status.${s}`);
export const STATUS_HINT = byStatus((s) => `lorebooks.statusHint.${s}`);

/** Engine position code -> the name its copy keys are filed under. */
const POS_NAME: Record<number, string> = { 0: "beforeChar", 1: "afterChar", 2: "depth", 7: "outlet" };

const byPosition = (key: (name: string) => string): Record<number, string> =>
  Object.fromEntries(Object.entries(POS_NAME).map(([p, name]) => [Number(p), tAny(key(name))]));

export const POS_COMPACT = byPosition((name) => `lorebooks.pos.${name}.compact`);
// `outlet` reads the same at both densities, and one string may hold only one
// key (design/copycheck.mjs), so the full table borrows the compact label there
// rather than registering a second entry with identical text.
export const POS_FULL = byPosition((name) =>
  name === "outlet" ? "lorebooks.pos.outlet.compact" : `lorebooks.pos.${name}.full`);
