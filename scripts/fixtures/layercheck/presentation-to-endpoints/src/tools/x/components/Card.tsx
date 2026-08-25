import { load } from "../api/notes";
export const Card = () => <b>{load().length}</b>;
