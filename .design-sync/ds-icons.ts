// Re-exports the console's own icon vocabulary into the design-system bundle,
// wired via cfg.extraEntries.
//
// src/ui/icons.tsx is deliberately NOT in the src/ui/index.ts barrel — inside
// the app every screen imports it directly, so it never needed to be. But the
// design system is a different consumer: EmptyState, ErrorState and SheetHead
// all take an `icon` prop, and without these names a design agent has nothing
// to put in it and will reach for some other icon set. These are already
// inlined in the bundle (the components import them), so exporting them costs
// no meaningful size.
//
// This does not change the app's own public surface; only the DS namespace.
export * from "../src/ui/icons";
