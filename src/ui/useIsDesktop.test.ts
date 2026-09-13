import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import theme from "../styles/theme.css?raw";
import { SPLIT, useIsDesktop } from "./useIsDesktop";

type MatchMedia = (query: string) => { matches: boolean };
const win = window as unknown as { matchMedia?: MatchMedia };

afterEach(() => {
  delete win.matchMedia;
});

function Probe() {
  return createElement("span", null, String(useIsDesktop()));
}

describe("SPLIT", () => {
  it("matches the split breakpoint token in theme.css", () => {
    const token = /--breakpoint-split:\s*([^;]+);/.exec(theme)?.[1];
    expect(SPLIT).toBe(`(min-width: ${token})`);
  });
});

describe("useIsDesktop", () => {
  it("asks matchMedia for the split query", () => {
    const matchMedia = vi.fn<MatchMedia>(() => ({ matches: true }));
    win.matchMedia = matchMedia;
    renderToString(createElement(Probe));
    expect(matchMedia).toHaveBeenCalledWith(SPLIT);
  });

  it("reports the initial match", () => {
    win.matchMedia = () => ({ matches: true });
    expect(renderToString(createElement(Probe))).toContain("true");
    win.matchMedia = () => ({ matches: false });
    expect(renderToString(createElement(Probe))).toContain("false");
  });
});
