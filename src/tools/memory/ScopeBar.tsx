// The scope bar: one value, read by every memory view. Scope sits above the
// views because it decides what they show.
//
// Two levels: character → chat. There is deliberately no branch level — the
// engine exposes no branch data through this console (no /branches route, and
// chats carry no branch field), so a branch control could never work.
//
// Each level is its own disclosure: opening "chat" does not disturb the
// character above it. The search field never autofocuses — opening a picker
// should not take the keyboard from someone who came to click.

import { useMemo } from "react";
import { SCOPE_ICON } from "../../ui/icons";
import { t } from "../../copy";
import { scopeChatId, scopeCharacterId, setScope, setScopeCharacter, type Chat, type Character } from "./store/scope";
import { SearchDisclosure } from "../../ui";
import { useStore } from "../../lib/store";

export function ScopeBar({ chats, characters }: { chats: Chat[]; characters: Character[] }) {
  const charId = useStore(scopeCharacterId);
  const chatId = useStore(scopeChatId);
  // The cascade: choosing a character narrows the chats below it.
  const chatsInScope = useMemo(
    () => (charId ? chats.filter((c) => (c.characterIds ?? []).includes(charId)) : chats),
    [chats, charId]);
  const character = characters.find((c) => c.id === charId);
  const chat = chats.find((c) => c.id === chatId);

  // A path, not a row of buttons: the levels read left to right with a
  // separator between them, because scope is a location.
  return (
    <div className="scoperow">
      <span className="scopelab t-label t-label-s">{t("sourcesworkspace.importScope")}</span>
      <SearchDisclosure label={t("sourcesworkspace.character")} icon={SCOPE_ICON.character}
        value={character?.name ?? t("sourcesworkspace.allCharacters")} allLabel={t("sourcesworkspace.allCharacters")}
        current={charId} options={characters.map((c) => ({ id: c.id, name: c.name }))}
        emptyText={t("memoryvault.noMatchingCharacters")}
        onPick={(id) => setScopeCharacter(id)} />
      <span className="scopesep" aria-hidden="true" data-contrast-exempt>›</span>
      <SearchDisclosure label={t("sourcesworkspace.chat")} icon={SCOPE_ICON.chat}
        value={chat?.name ?? t("sourcesworkspace.allChats")} allLabel={t("sourcesworkspace.allChats")}
        current={chatId}
        options={chatsInScope.map((c) => ({ id: c.id, name: c.name ?? c.id, hint: c.mode }))}
        emptyText={t("memoryvault.noMatchingChats")}
        onPick={(id) => setScope(id)} />
    </div>
  );
}
