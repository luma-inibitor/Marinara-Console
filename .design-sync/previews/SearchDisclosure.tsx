import { SearchDisclosure, Tags, VIEW_ICON, SCOPE_ICON } from "marinara-console";

// The lorebook trigger borrows the vault glyph and the chat trigger the chat
// glyph — one icon per concept, taken from the console's own map rather than
// picked fresh (design/CHECKLIST.md §4).
const Library = VIEW_ICON.vault;
const Chat = SCOPE_ICON.chat;

const books = [
  { id: "harbour", name: "Harbour Ledger", hint: "213 entries" },
  { id: "meridian", name: "Meridian Archive", hint: "88 entries" },
  { id: "ashgate", name: "Ashgate Writs", hint: "41 entries" },
  { id: "salvage", name: "Salvage Desk Rota", hint: "17 entries" },
];

/** The trigger shows the current value, so the control reads as part of a
 *  sentence rather than a button that hides its state. This is the resting
 *  state — the panel opens on click, which a static card cannot show. */
export function Scope() {
  return (
    <div style={{ display: "flex", gap: "var(--s2)", alignItems: "center" }}>
      <SearchDisclosure
        label="Lorebook" value="Harbour Ledger" icon={Library}
        options={books} allLabel="All lorebooks" current="harbour"
        onPick={() => {}} emptyText="No lorebook matches that."
      />
    </div>
  );
}

/** Cleared: the trigger renders the all-label, so "no filter" is still a
 *  readable state rather than an empty control. */
export function Cleared() {
  return (
    <div style={{ display: "flex", gap: "var(--s2)", alignItems: "center" }}>
      <SearchDisclosure
        label="Lorebook" value="All lorebooks" icon={Library}
        options={books} allLabel="All lorebooks" current="all"
        onPick={() => {}} emptyText="No lorebook matches that."
      />
    </div>
  );
}

/** Several in a toolbar, which is the arrangement this control is for —
 *  a run of filters that each read as a phrase. */
export function Toolbar() {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--s2)", alignItems: "center" }}>
      <SearchDisclosure
        label="Lorebook" value="Harbour Ledger" icon={Library}
        options={books} allLabel="All lorebooks" current="harbour"
        onPick={() => {}} emptyText="No lorebook matches that."
      />
      <SearchDisclosure
        label="Tag" value="writ" icon={Tags}
        options={[{ id: "writ", name: "writ", hint: "41" }, { id: "harbour", name: "harbour", hint: "62" }]}
        allLabel="All tags" current="writ"
        onPick={() => {}} emptyText="No tag matches that."
      />
      <SearchDisclosure
        label="Scope" value="All chats" icon={Chat}
        options={[{ id: "chat_2f8b41c9", name: "chat_2f8b41c9-harbour-writ" }]}
        allLabel="All chats" current="all"
        onPick={() => {}} emptyText="No chat matches that."
      />
    </div>
  );
}
