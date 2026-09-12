import { describe, expect, it } from "vitest";
import { band, percent } from "./Meter";

describe("percent", () => {
  it("is the value's share of the maximum", () => {
    expect(percent(25, 100)).toBe(25);
    expect(percent(1, 4)).toBe(25);
  });

  it("caps at 100", () => {
    expect(percent(150, 100)).toBe(100);
  });

  it("is 0 for an empty, negative or unbounded meter", () => {
    expect(percent(0, 100)).toBe(0);
    expect(percent(-5, 100)).toBe(0);
    expect(percent(5, 0)).toBe(0);
  });
});

describe("band", () => {
  it("is under without thresholds", () => {
    expect(band(99, 100)).toBe("under");
  });

  it("crosses each threshold at the fraction given", () => {
    expect(band(79, 100, 0.8, 1)).toBe("under");
    expect(band(80, 100, 0.8, 1)).toBe("near");
    expect(band(99, 100, 0.8, 1)).toBe("near");
    expect(band(100, 100, 0.8, 1)).toBe("over");
    expect(band(140, 100, 0.8, 1)).toBe("over");
  });

  it("takes each threshold on its own", () => {
    expect(band(90, 100, undefined, 0.95)).toBe("under");
    expect(band(96, 100, undefined, 0.95)).toBe("over");
    expect(band(96, 100, 0.75)).toBe("near");
  });

  it("is under when the maximum is 0", () => {
    expect(band(5, 0, 0.8, 1)).toBe("under");
  });
});
