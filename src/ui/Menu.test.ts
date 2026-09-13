import { describe, expect, it } from "vitest";
import { step } from "./Menu";

describe("step", () => {
  it("moves down and wraps to the first item", () => {
    expect(step("ArrowDown", 0, 3)).toBe(1);
    expect(step("ArrowDown", 2, 3)).toBe(0);
  });

  it("moves up and wraps to the last item", () => {
    expect(step("ArrowUp", 1, 3)).toBe(0);
    expect(step("ArrowUp", 0, 3)).toBe(2);
  });

  it("starts at the first item when nothing is focused", () => {
    expect(step("ArrowDown", -1, 3)).toBe(0);
    expect(step("ArrowUp", -1, 3)).toBe(2);
  });

  it("jumps with Home and End", () => {
    expect(step("Home", 2, 3)).toBe(0);
    expect(step("End", 0, 3)).toBe(2);
  });

  it("leaves every other key alone", () => {
    expect(step("Tab", 0, 3)).toBeNull();
    expect(step("a", 0, 3)).toBeNull();
  });
});
