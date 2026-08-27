import { describe, expect, it } from "vitest";
import { cx } from "./cx";

// A wrong class group fails the way the bugs cx prevents failed: at render,
// with no error. These pin the cases where being wrong is plausible.
describe("cx", () => {
  it("keeps the last of two utilities on one property", () => {
    // Both shipped broken in Button before cx existed.
    expect(cx("uppercase", "normal-case")).toBe("normal-case");
    expect(cx("border-transparent", "border-edge-strong")).toBe("border-edge-strong");
  });

  it("does not confuse a font size with a text colour", () => {
    expect(cx("text-label", "text-ink")).toBe("text-label text-ink");
    expect(cx("text-data-s", "text-dim")).toBe("text-data-s text-dim");
    expect(cx("text-label", "text-data")).toBe("text-data");
    expect(cx("text-ink", "text-danger")).toBe("text-danger");
  });

  it("resolves the theme's own colour names per property", () => {
    expect(cx("bg-accent", "bg-danger")).toBe("bg-danger");
    expect(cx("border-edge", "border-edge-strong")).toBe("border-edge-strong");
    expect(cx("border", "border-accent")).toBe("border border-accent");
  });

  it("resolves the spacing scale, including the tap floors", () => {
    expect(cx("px-4", "px-2")).toBe("px-2");
    expect(cx("min-h-tap", "min-h-tap-2")).toBe("min-h-tap-2");
    expect(cx("px-4", "min-h-tap")).toBe("px-4 min-h-tap");
  });

  it("leaves classes that are not Tailwind alone", () => {
    expect(cx("btn-thing", "hit")).toBe("btn-thing hit");
    expect(cx("px-4", "hit", "px-2")).toBe("hit px-2");
  });

  it("drops falsy entries so callers can use && without a filter", () => {
    expect(cx("px-4", false, undefined, null, "text-dim")).toBe("px-4 text-dim");
  });
});
