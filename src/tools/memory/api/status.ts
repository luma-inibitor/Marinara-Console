// Engine health: the counts and the index state, plus the one repair.

import { call } from "./client";
import type { LtmStatus } from "./types";

export const ltmStatus = (): Promise<LtmStatus> => call("GET /status");

export const rebuildIndexes = () => call("POST /rebuild", { body: {} });
