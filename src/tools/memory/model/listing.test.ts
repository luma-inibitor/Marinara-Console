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
