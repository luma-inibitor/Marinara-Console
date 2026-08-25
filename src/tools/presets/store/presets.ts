// The preset tool's data boundary. The editor still holds its own loaded
// preset in component state, so nothing is owned here yet; what this module
// gives it is a layer to call instead of `api/`, which presentation may not
// reach (ARCHITECTURE.md §3).
export {
  fetchPresets, fetchFull, patchPreset, patchSection, createSection, deleteSection,
  duplicatePreset, setDefaultPreset,
} from "../api/prompts";
