import { NotFound } from "marinara-console";

/** The default destination, for a caller that names none. */
export function Record() {
  return (
    <div style={{ maxWidth: 460 }}>
      <NotFound what="Lorebook" id="book_harbour_ledger" />
    </div>
  );
}

/** A caller that owns its own list names both the route and its label. */
export function Routed() {
  return (
    <div style={{ maxWidth: 460 }}>
      <NotFound what="Preset" id="preset_salvage_desk" backTo="presets" backLabel="Back to presets" />
    </div>
  );
}
