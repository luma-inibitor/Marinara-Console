import { describe, expect, it } from "vitest";
import { GAP, MARGIN, place } from "./Popover";

const viewport = { width: 400, height: 800 };
const surface = { top: 0, left: 0, width: 200, height: 100 };
const anchor = { top: 100, left: 50, width: 40, height: 30 };

describe("place", () => {
  it("sits below the anchor, aligned to its start", () => {
    expect(place(anchor, surface, viewport, "bottom", "start")).toEqual({ top: 134, left: 50, side: "bottom" });
  });

  it("aligns to the anchor's end", () => {
    expect(place({ ...anchor, left: 300 }, surface, viewport, "bottom", "end").left).toBe(300 + 40 - 200);
  });

  it("sits above the anchor when asked", () => {
    const at = place({ ...anchor, top: 400 }, surface, viewport, "top", "start");
    expect(at).toEqual({ top: 400 - GAP - 100, left: 50, side: "top" });
  });

  it("flips above when there is no room below", () => {
    const at = place({ ...anchor, top: 750 }, surface, viewport, "bottom", "start");
    expect(at.side).toBe("top");
    expect(at.top).toBe(750 - GAP - 100);
  });

  it("flips below when there is no room above", () => {
    const at = place({ ...anchor, top: 20 }, surface, viewport, "top", "start");
    expect(at.side).toBe("bottom");
    expect(at.top).toBe(20 + 30 + GAP);
  });

  it("keeps the preferred side when neither side has room", () => {
    const tall = { ...surface, height: 700 };
    const at = place({ ...anchor, top: 390 }, tall, viewport, "bottom", "start");
    expect(at.side).toBe("bottom");
    expect(at.top).toBe(viewport.height - MARGIN - 700);
  });

  it("slides inside the viewport horizontally", () => {
    expect(place({ ...anchor, left: 350 }, surface, viewport, "bottom", "start").left).toBe(400 - MARGIN - 200);
    expect(place({ ...anchor, left: 2 }, surface, viewport, "bottom", "end").left).toBe(MARGIN);
  });
});
