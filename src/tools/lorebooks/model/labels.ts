/* @copy-strict */
// The entry's status, hint and position labels.
//
// No position rule in design/copycheck.mjs reaches a label in an object
// initialiser, so the marker above is what makes an unrouted label fail the
// check. Do not drop it.
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
