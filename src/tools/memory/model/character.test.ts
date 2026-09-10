// The one rule worth pinning here: a character always ends up with a name to
// show. The hoisted field wins, the card JSON is the fallback, and anything
// unreadable falls back to the id rather than to a blank row.

import { describe, expect, it } from "vitest";
import { parseCharacter } from "./character";

describe("parseCharacter", () => {
  it("prefers the hoisted name and never parses the card", () => {
    expect(parseCharacter({ id: "c1", name: "Marin", data: '{"name":"Other"}' })).toEqual({ id: "c1", name: "Marin" });
  });

  it("reads the name out of the card JSON when it was not hoisted", () => {
    expect(parseCharacter({ id: "c2", data: '{"name":"Marin"}' })).toEqual({ id: "c2", name: "Marin" });
  });

  it("falls back to the id when the card carries no name", () => {
    expect(parseCharacter({ id: "c3", data: "{}" })).toEqual({ id: "c3", name: "c3" });
    expect(parseCharacter({ id: "c4" })).toEqual({ id: "c4", name: "c4" });
  });

  it("falls back to the id when the card will not parse", () => {
    expect(parseCharacter({ id: "c5", data: "not json" })).toEqual({ id: "c5", name: "c5" });
  });

  it("treats an empty hoisted name as absent", () => {
    expect(parseCharacter({ id: "c6", name: "", data: '{"name":"Marin"}' })).toEqual({ id: "c6", name: "Marin" });
  });
});
