import { describe, expect, it } from "vitest";
import { preset } from "../test/factories";
import { expand } from "./macros";

describe("expand", () => {
  it("fills a macro from the preset's saved choices", () => {
    expect(expand("You are {{role}}.", preset({ defaultChoices: { role: "a narrator" } })))
      .toBe("You are a narrator.");
  });

  it("joins a multi-select choice", () => {
    expect(expand("{{tones}}", preset({ defaultChoices: { tones: ["dry", "warm"] } })))
      .toBe("dry, warm");
  });

  it("leaves a macro the preset does not answer for, because runtime does", () => {
    expect(expand("Hello {{user}}.", preset())).toBe("Hello {{user}}.");
  });

  it("matches a macro whatever its case", () => {
    expect(expand("{{ROLE}}", preset({ defaultChoices: { ROLE: "a narrator" } }))).toBe("a narrator");
  });
});
