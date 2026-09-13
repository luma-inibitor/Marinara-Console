import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { rovingFocus } from "./useRovingFocus";

type Opts = Parameters<typeof rovingFocus>[0]["current"];

interface FakeEl {
  tagName?: string;
  isContentEditable?: boolean;
  closest?: (sel: string) => FakeEl | null;
}

function make(over: Partial<Opts> = {}) {
  const opts: Opts = {
    listRef: { current: null },
    keys: ["a", "b", "c"],
    current: null,
    onFocus: vi.fn(),
    ...over,
  };
  return { opts, api: rovingFocus({ current: opts }) };
}

function key(
  k: string,
  target: FakeEl | null = { tagName: "DIV" },
  mods: Partial<Record<"metaKey" | "ctrlKey" | "altKey", boolean>> = {},
) {
  return { key: k, metaKey: false, ctrlKey: false, altKey: false, ...mods, target: target as unknown as EventTarget };
}

const raf = vi.fn();

beforeEach(() => {
  raf.mockReset();
  vi.stubGlobal("CSS", { escape: (s: string) => `<${s}>` });
  vi.stubGlobal("requestAnimationFrame", raf);
});
afterEach(() => vi.unstubAllGlobals());

describe("ignore", () => {
  it("ignores any event carrying a modifier", () => {
    const { api } = make();
    expect(api.ignore(key("j", undefined, { metaKey: true }))).toBe(true);
    expect(api.ignore(key("j", undefined, { ctrlKey: true }))).toBe(true);
    expect(api.ignore(key("j", undefined, { altKey: true }))).toBe(true);
  });

  it("handles a plain key on a plain target", () => {
    const { api } = make();
    expect(api.ignore(key("j"))).toBe(false);
  });

  it("handles a plain key with no target", () => {
    const { api } = make();
    expect(api.ignore(key("j", null))).toBe(false);
  });

  it("leaves the keyboard with someone typing", () => {
    const { api } = make();
    for (const tagName of ["INPUT", "TEXTAREA", "SELECT"]) expect(api.ignore(key("j", { tagName }))).toBe(true);
    expect(api.ignore(key("j", { tagName: "DIV", isContentEditable: true }))).toBe(true);
  });

  it("leaves a button outside the rows its own keys", () => {
    const { api } = make({ rowSelector: ".row", navKeys: ["j", "k"] });
    const outside: FakeEl = { tagName: "BUTTON", closest: (sel) => (sel === "button" ? outside : null) };
    expect(api.ignore(key("Enter", outside))).toBe(true);
    expect(api.ignore(key("j", outside))).toBe(false);
  });

  it("keeps handling a button inside a row", () => {
    const { api } = make({ rowSelector: ".row", navKeys: ["j", "k"] });
    const inside: FakeEl = { tagName: "BUTTON", closest: () => inside };
    expect(api.ignore(key("Enter", inside))).toBe(false);
  });

  it("handles a button when no row selector is configured", () => {
    const { api } = make();
    const button: FakeEl = { tagName: "BUTTON", closest: () => null };
    expect(api.ignore(key("Enter", button))).toBe(false);
  });
});

describe("move", () => {
  it("does nothing on an empty list", () => {
    const { opts, api } = make({ keys: [] });
    api.move(1);
    expect(opts.onFocus).not.toHaveBeenCalled();
  });

  it("starts at the top on a step down from nowhere", () => {
    const { opts, api } = make();
    api.move(1);
    expect(opts.onFocus).toHaveBeenCalledWith("a");
  });

  it("starts at the bottom on a step up from nowhere", () => {
    const { opts, api } = make();
    api.move(-1);
    expect(opts.onFocus).toHaveBeenCalledWith("c");
  });

  it("steps from the current row", () => {
    const { opts, api } = make({ current: "b" });
    api.move(1);
    expect(opts.onFocus).toHaveBeenLastCalledWith("c");
    api.move(-1);
    expect(opts.onFocus).toHaveBeenLastCalledWith("a");
  });

  it("stays put at either end instead of wrapping", () => {
    const top = make({ current: "a" });
    top.api.move(-1);
    expect(top.opts.onFocus).toHaveBeenCalledWith("a");
    const bottom = make({ current: "c" });
    bottom.api.move(1);
    expect(bottom.opts.onFocus).toHaveBeenCalledWith("c");
  });

  it("reads the options at call time", () => {
    const box = { current: { listRef: { current: null }, keys: ["a"], current: null, onFocus: vi.fn() } as Opts };
    const api = rovingFocus(box);
    box.current = { ...box.current, keys: ["x", "y"], current: "x" };
    api.move(1);
    expect(box.current.onFocus).toHaveBeenCalledWith("y");
  });
});

describe("tabbable", () => {
  it("is the current row when there is one", () => {
    const { api } = make({ current: "b" });
    expect(api.tabbable("b")).toBe(true);
    expect(api.tabbable("a")).toBe(false);
  });

  it("falls to the first row without a cursor", () => {
    const { api } = make();
    expect(api.tabbable("a")).toBe(true);
    expect(api.tabbable("b")).toBe(false);
  });

  it("is nothing on an empty list", () => {
    const { api } = make({ keys: [] });
    expect(api.tabbable("a")).toBe(false);
  });
});

describe("reveal", () => {
  function list(found: unknown) {
    const querySelector = vi.fn(() => found);
    return { listRef: { current: { querySelector } as unknown as HTMLElement }, querySelector };
  }

  it("focuses, scrolls and lands synchronously when the row is present", () => {
    const el = { scrollIntoView: vi.fn(), focus: vi.fn() };
    const { listRef, querySelector } = list(el);
    const { opts, api } = make({ listRef });
    api.reveal("b");
    expect(opts.onFocus).toHaveBeenCalledWith("b");
    expect(querySelector).toHaveBeenCalledWith('[data-row="<b>"]');
    expect(el.scrollIntoView).toHaveBeenCalledWith({ block: "nearest" });
    expect(el.focus).toHaveBeenCalledWith({ preventScroll: true });
    expect(raf).not.toHaveBeenCalled();
  });

  it("defers a frame when the row is not rendered yet", () => {
    const { listRef } = list(null);
    const { opts, api } = make({ listRef });
    api.reveal("b");
    expect(opts.onFocus).toHaveBeenCalledWith("b");
    expect(raf).toHaveBeenCalledTimes(1);
  });

  it("survives a row that cannot take focus", () => {
    const el = { scrollIntoView: vi.fn() };
    const { listRef } = list(el);
    const { api } = make({ listRef });
    expect(() => api.reveal("a")).not.toThrow();
    expect(el.scrollIntoView).toHaveBeenCalled();
  });
});
