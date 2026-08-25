// Archiving is the only status that takes a memory out of the vault list.
// Pinned as a predicate rather than as an inline filter because the list, the
// two tab counts and the type chips all have to agree about it — three call
// sites reading one rule.

import { describe, expect, it } from "vitest";
import { makeNote } from "../test/factories";
import { listedInVault } from "./listing";

describe("listedInVault", () => {
  it("hides an archived memory", () => {
    expect(listedInVault(makeNote({ status: "archived" }))).toBe(false);
  });

  it.each(["active", "resolved"] as const)("keeps a %s memory", (status) => {
    expect(listedInVault(makeNote({ status }))).toBe(true);
  });

  it("keeps a memory whose status the engine has not given us", () => {
    expect(listedInVault(makeNote({ status: undefined as never }))).toBe(true);
  });
});
