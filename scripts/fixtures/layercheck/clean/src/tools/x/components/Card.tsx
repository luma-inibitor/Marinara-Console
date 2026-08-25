import { first } from "../store/notes";
import { idOf } from "../model/note";
export const Card = () => <b>{first() + idOf({ id: "" })}</b>;
