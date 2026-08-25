// The review ledger's record: what the reviewer decided, kept by the console
// rather than by the engine. It is console state, so it hangs off
// /console/state rather than off LTM — one key, keyed by engine target.

import * as v from "valibot";
import { readConsoleState, writeConsoleState } from "../../../shell/state";
import { parseWire } from "../../../shell/wire";
import { MutationSchema } from "./schema";
import type { Decision } from "../model/review";

const KEY = "ltm-review";

const DECISIONS = ["keep", "drop"] as const satisfies readonly Decision[];

/** Every field optional: `{}` is what a key nothing has written answers with. */
const LedgerSchema = v.looseObject({
  dec: v.optional(v.record(v.string(), v.picklist(DECISIONS))),
  edited: v.optional(v.record(v.string(), MutationSchema)),
  savedAt: v.optional(v.string()),
});

type LedgerRecord = v.InferOutput<typeof LedgerSchema>;

export const fetchLedger = async (): Promise<LedgerRecord> =>
  parseWire(LedgerSchema, await readConsoleState<unknown>(KEY), `GET /console/state/${KEY}`);

export const saveLedger = (record: LedgerRecord, keepalive = false) =>
  writeConsoleState(KEY, record, { keepalive });
