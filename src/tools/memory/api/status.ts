// Engine health: the counts and the index state, plus the one repair.

import { api } from "../../../shell/api";
import { parseWire } from "../../../shell/wire";
import { LTM } from "./routes";
import { LtmStatusSchema } from "./schema";
import type { LtmStatus } from "./types";

export const ltmStatus = async (): Promise<LtmStatus> =>
  parseWire(LtmStatusSchema, await api(`${LTM}/status`), `GET ${LTM}/status`);

/** Unparsed: nothing reads the reply, and the caller retakes /status after. */
export const rebuildIndexes = () => api(`${LTM}/rebuild`, { method: "POST", body: {} });
