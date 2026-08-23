// The scope bar: one value, read by every memory view (approved wireframes,
// public/mockups/nav-wire.html §N2/N3). Scope sits above the views because it
// decides what they show.
//
// Two levels ship: character → chat. Branch is drawn in the wireframes but the
// engine exposes no branch data through this console — no /branches route, and
// chats carry no branch field — so it is left out rather than rendered as a
// control that can never work. Backlogged with what it needs.
//
// Each level is its own disclosure: opening "chat" does not disturb the
// character above it. The search field never autofocuses (owner's call) —
// opening a picker should not take the keyboard from someone who came to click.

import { useEffect, useMemo, useRef, useState } from "preact/hooks";
import { IconUser, IconMessageCircle, IconSearch, IconChevronDown, type Icon } from "@tabler/icons-preact";
import { api } from "../../shell/api";
import { t } from "./strings";
import { scopeChatId, scopeCharacterId, setScope, setScopeCharacter } from "./store";

export interface Chat { id: string; name?: string; mode?: string; characterIds?: string[] }
export interface Character { id: string; name: string }

/** Characters arrive with their card JSON in a string field. */
function parseCharacter(c: { id: string; data?: string; name?: string }): Character {
  if (c.name) return { id: c.id, name: c.name };
  try { return { id: c.id, name: (JSON.parse(c.data ?? "{}") as { name?: string }).name ?? c.id }; }
  catch { return { id: c.id, name: c.id }; }
}

export function useScopeData() {
  const [chats, setChats] = useState<Chat[]>([]);
  const [characters, setCharacters] = useState<Character[]>([]);
  useEffect(() => {
    api<Chat[] | { items: Chat[] }>("/chats")
      .then((r) => setChats(Array.isArray(r) ? r : r.items ?? [])).catch(() => setChats([]));
    api<Array<{ id: string; data?: string; name?: string }>>("/characters")
      .then((r) => setCharacters((Array.isArray(r) ? r : []).map(parseCharacter))).catch(() => setCharacters([]));
  }, []);
  return { chats, characters };
}

function Disclosure(props: {
  label: string; value: string; icon: Icon;
  options: Array<{ id: string; name: string; hint?: string }>; allLabel: string;
  current: string; onPick: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", away);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("mousedown", away); document.removeEventListener("keydown", esc); };
  }, [open]);
  const needle = q.trim().toLowerCase();
  const shown = needle ? props.options.filter((o) => o.name.toLowerCase().includes(needle)) : props.options;
  const I = props.icon;
  return (
    <div class="scopelevel" ref={ref}>
      <button class="scopesel hit" aria-expanded={open} aria-label={`${props.label}: ${props.value}`}
        onClick={() => { setOpen(!open); setQ(""); }}>
        <I size={14} stroke={1.75} />
        <span class="scopeval">{props.value}</span>
        <IconChevronDown size={13} stroke={1.75} aria-hidden />
      </button>
      {open && (
        <div class="scopepop" role="dialog" aria-label={props.label}>
          <label class="sinput scopesearch">
            <IconSearch size={14} stroke={1.75} aria-hidden />
            {/* deliberately not autofocused */}
            <input class="t-prose" placeholder={`Search ${props.label.toLowerCase()}`} value={q}
              onInput={(e) => setQ(e.currentTarget.value)} aria-label={`Search ${props.label.toLowerCase()}`} />
          </label>
          <div class="scopelist">
            <button class={`scopeopt hit ${props.current === "" ? "is-on" : ""}`}
              onClick={() => { props.onPick(""); setOpen(false); }}>{props.allLabel}</button>
            {shown.map((o) => (
              <button key={o.id} class={`scopeopt hit ${props.current === o.id ? "is-on" : ""}`}
                onClick={() => { props.onPick(o.id); setOpen(false); }}>
                <span class="scopeoptname">{o.name}</span>
                {o.hint && <span class="scopeopthint t-data">{o.hint}</span>}
              </button>
            ))}
            {shown.length === 0 && <p class="scopenone t-prose dim">{t("memoryvault.noMatchingChats")}</p>}
          </div>
        </div>
      )}
    </div>
  );
}

export function ScopeBar({ chats, characters }: { chats: Chat[]; characters: Character[] }) {
  const charId = scopeCharacterId.value;
  // The cascade: choosing a character narrows the chats below it.
  const chatsInScope = useMemo(
    () => (charId ? chats.filter((c) => (c.characterIds ?? []).includes(charId)) : chats),
    [chats, charId]);
  const character = characters.find((c) => c.id === charId);
  const chat = chats.find((c) => c.id === scopeChatId.value);

  return (
    <div class="scoperow">
      <span class="scopelab t-label t-label-s">{t("sourcesworkspace.importScope")}</span>
      <Disclosure label="Character" icon={IconUser}
        value={character?.name ?? "All characters"} allLabel="All characters"
        current={charId} options={characters.map((c) => ({ id: c.id, name: c.name }))}
        onPick={(id) => setScopeCharacter(id)} />
      <Disclosure label="Chat" icon={IconMessageCircle}
        value={chat?.name ?? t("sourcesworkspace.allChats")} allLabel={t("sourcesworkspace.allChats")}
        current={scopeChatId.value}
        options={chatsInScope.map((c) => ({ id: c.id, name: c.name ?? c.id, hint: c.mode }))}
        onPick={(id) => setScope(id)} />
    </div>
  );
}
