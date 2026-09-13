import { describe, expect, it } from "vitest";
import { clamp } from "./Progress";

describe("clamp", () => {
  it("keeps a value inside the range", () => {
    expect(clamp(3, 10)).toBe(3);
    expect(clamp(10, 10)).toBe(10);
  });

  it("caps at the maximum", () => {
    expect(clamp(12, 10)).toBe(10);
  });

  it("is 0 for an empty, negative or unbounded task", () => {
    expect(clamp(0, 10)).toBe(0);
    expect(clamp(-2, 10)).toBe(0);
    expect(clamp(2, 0)).toBe(0);
  });
});
