// Engine health: the counts and the index state, plus the one repair.

import { api } from "../../../shell/api";
import { LTM } from "./routes";
import type { LtmStatus } from "./types";

export const ltmStatus = () => api<LtmStatus>(`${LTM}/status`);
export const rebuildIndexes = () => api(`${LTM}/rebuild`, { method: "POST", body: {} });
