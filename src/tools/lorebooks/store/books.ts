// The lorebook tool's data boundary. The screens still hold their own books
// and entries in component state, so nothing is owned here yet; what this
// module gives them is a layer to call instead of `api/`, which presentation
// may not reach (ARCHITECTURE.md §3).
export { fetchBooks, fetchEntries, patchEntry, createEntry, deleteEntry, bulkPatch } from "../api/lorebooks";
