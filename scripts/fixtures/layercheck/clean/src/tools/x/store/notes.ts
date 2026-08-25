import { idOf } from "../model/note";
import { load } from "../api/notes";
export const first = () => idOf(load()[0]);
