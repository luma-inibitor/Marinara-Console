// The review ledger's record: what the reviewer decided, kept by the console
// rather than by the engine. It is console state, so it hangs off
// /console/state rather than off LTM — one key, keyed by engine target.

import { readConsoleState, writeConsoleState } from "../../../shell/state";
import type { Mutation } from "./types";
import type { Decision } from "../model/review";

const KEY = "ltm-review";

interface LedgerRecord {
  dec?: Record<string, Decision>;
  edited?: Record<string, Mutation>;
  savedAt?: string;
}

export const fetchLedger = () => readConsoleState<LedgerRecord>(KEY);

export const saveLedger = (record: LedgerRecord, keepalive = false) =>
  writeConsoleState(KEY, record, { keepalive });
