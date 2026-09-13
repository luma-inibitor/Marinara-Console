import { describe, expect, it } from "vitest";
import { describedBy } from "./Field";

describe("describedBy", () => {
  it("is undefined with nothing to describe", () => {
    expect(describedBy()).toBeUndefined();
    expect(describedBy(undefined, undefined)).toBeUndefined();
  });

  it("names the hint alone and the error alone", () => {
    expect(describedBy("f-hint")).toBe("f-hint");
    expect(describedBy(undefined, "f-error")).toBe("f-error");
  });

  it("reads the hint before the error", () => {
    expect(describedBy("f-hint", "f-error")).toBe("f-hint f-error");
  });
});
