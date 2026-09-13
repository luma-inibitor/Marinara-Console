import { describe, expect, it } from "vitest";
import theme from "../styles/theme.css?raw";
import { cn, THEME } from "./cn";

const scale = (prefix: string) =>
  [...theme.matchAll(new RegExp(`--${prefix}-([\\w-]+):`, "g"))].map((m) => m[1]).sort();

describe("THEME", () => {
  it("lists every scale theme.css declares", () => {
    for (const [key, names] of Object.entries(THEME)) {
      expect([...names].sort(), key).toEqual(scale(key));
    }
  });
});

describe("cn", () => {
  it("keeps a font size beside a colour", () => {
    expect(cn("text-label text-ink")).toBe("text-label text-ink");
  });

  it("keeps a family beside a weight", () => {
    expect(cn("font-label font-semibold")).toBe("font-label font-semibold");
  });

  it("lets the last utility win", () => {
    expect(cn("px-4", "px-3")).toBe("px-3");
    expect(cn("invisible", false, "visible")).toBe("visible");
  });
});
