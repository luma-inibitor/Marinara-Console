import { type Row } from "../api/types";
import type { Row as R2 } from "../api/types";
export const idOf = (r: Row, s: R2) => r.id + s.id;
