// Exists solely so `detail/` keeps resolving: `detail/RetrievalCard.tsx`
// imports `notesById` from `"../store"`, and `store.ts` is gone.
//
// It re-exports exactly one name on purpose. A general-purpose barrel over
// `store/` would get imported by everyone, and a state layer whose modules all
// reach each other through one file is the tangle this split undid. Delete
// this file when open question 2 — whether `detail/` survives — is decided.

export { notesById } from "./notes";
