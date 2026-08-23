// The console's shared UI vocabulary. Anything used by more than one screen
// belongs here; anything used by one screen belongs beside that screen.
//
// Each component owns its own stylesheet, so deleting the component deletes
// its rules. That is the point: a first sweep of the old global sheets found
// twenty rules whose last consumer had been gone for weeks, and nothing had
// said so.
export { Chip, Tag } from "./Chip";
export { Edu } from "./Edu";
export { EmptyState } from "./EmptyState";
export { IconButton } from "./IconButton";
export { collapsedGroups } from "./useCollapsedGroups";
export { useIsDesktop } from "./useIsDesktop";
