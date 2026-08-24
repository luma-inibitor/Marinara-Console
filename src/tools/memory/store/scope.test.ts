// Changing scope, and what has to reach storage when it does.
//
// `useScope` is deliberately uncovered — it is a React hook and this suite runs
// in the node environment with no DOM.

import { beforeEach, describe, expect, it } from "vitest";
import { currentScope, scopeCharacterId, scopeChatId, setScope, setScopeCharacter } from "./scope";

/** The stores are module-level singletons seeded from localStorage at import
 *  time, so a test that writes scope leaks into every test after it unless the
 *  singletons themselves are put back. */
beforeEach(() => {
  scopeChatId.set("");
  scopeCharacterId.set("");
  localStorage.clear();
});

describe("setScope / setScopeCharacter", () => {
  it("writes the chat through to the store and to localStorage", () => {
    setScope("chat-1");
    expect(scopeChatId.get()).toBe("chat-1");
    expect(localStorage.getItem("mc-ltm-chat")).toBe("chat-1");
  });

  it("writes the character through to the store and to localStorage", () => {
    setScopeCharacter("char-1");
    expect(scopeCharacterId.get()).toBe("char-1");
    expect(localStorage.getItem("mc-ltm-character")).toBe("char-1");
  });

  it("clears the selected chat when a character is chosen", () => {
    // The chosen chat may not belong under the new character, so it cannot
    // stay selected — and the cleared value has to reach storage too, or a
    // reload would restore the stale chat.
    setScope("chat-1");
    setScopeCharacter("char-1");
    expect(scopeChatId.get()).toBe("");
    expect(localStorage.getItem("mc-ltm-chat")).toBe("");
  });

  it("keeps the selected chat when the character is cleared", () => {
    setScope("chat-1");
    setScopeCharacter("");
    expect(scopeChatId.get()).toBe("chat-1");
    expect(scopeCharacterId.get()).toBe("");
  });

  it("currentScope reads both stores without subscribing", () => {
    setScopeCharacter("char-1");
    setScope("chat-1");
    expect(currentScope()).toEqual({ characterId: "char-1", chatId: "chat-1" });
  });
});
