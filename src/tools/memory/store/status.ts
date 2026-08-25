// Owns the engine's health: the status record every memory view reads for its
// fallback counts and its index banner, and the one repair that changes it.
//
// The tool shell used to hold these stores and call /status itself. They are
// entity state — a server-wide record with an action that writes to the engine
// — so they live here and the shell subscribes.
//
// A failed status is a store rather than a thrown error: the banner reports it
// and every screen behind it keeps working, so no caller ever has to catch.

import { createStore } from "../../../lib/store";
import type { LtmStatus } from "../api/types";
import { ltmStatus, rebuildIndexes as requestRebuild } from "../api/status";

export const status = createStore<LtmStatus | null>(null);
export const statusFailed = createStore(false);
export const rebuilding = createStore(false);

export async function refreshLtmStatus() {
  try {
    status.set(await ltmStatus());
    statusFailed.set(false);
  } catch {
    statusFailed.set(true);
  }
}

/** Rebuild the indexes and take the fresh status. Throws on failure — the copy
 *  for the toast belongs to the screen — and clears `rebuilding` either way. */
export async function rebuildIndexes(): Promise<void> {
  rebuilding.set(true);
  try {
    await requestRebuild();
    await refreshLtmStatus();
  } finally {
    rebuilding.set(false);
  }
}
