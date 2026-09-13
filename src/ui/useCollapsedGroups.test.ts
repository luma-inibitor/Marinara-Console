import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { collapsedGroups } from "./useCollapsedGroups";

const real = globalThis.localStorage;

beforeEach(() => localStorage.clear());
afterEach(() => {
  globalThis.localStorage = real;
});

const blocked = {
  getItem() {
    throw new Error("blocked");
  },
  setItem() {
    throw new Error("blocked");
  },
} as unknown as Storage;

describe("collapsedGroups without a key", () => {
  it("starts empty and toggles an id in and out", () => {
    const { ids, toggle } = collapsedGroups();
    expect(ids.get().size).toBe(0);
    toggle("a");
    expect(ids.get().has("a")).toBe(true);
    toggle("a");
    expect(ids.get().has("a")).toBe(false);
  });

  it("assigns a fresh Set on every toggle", () => {
    const { ids, toggle } = collapsedGroups();
    const before = ids.get();
    toggle("a");
    const after = ids.get();
    expect(after).not.toBe(before);
    expect(before.has("a")).toBe(false);
  });

  it("never touches storage", () => {
    const { toggle } = collapsedGroups();
    toggle("a");
    expect(localStorage.length).toBe(0);
  });
});

describe("collapsedGroups with a key", () => {
  it("seeds from the stored array", () => {
    localStorage.setItem("k", JSON.stringify(["a", "b"]));
    const { ids } = collapsedGroups("k");
    expect([...ids.get()]).toEqual(["a", "b"]);
  });

  it("keeps only the strings of a stored array", () => {
    localStorage.setItem("k", JSON.stringify(["a", 1, null, "b"]));
    const { ids } = collapsedGroups("k");
    expect([...ids.get()]).toEqual(["a", "b"]);
  });

  it("folds nothing for a corrupt or non-array value", () => {
    localStorage.setItem("k", "{not json");
    expect(collapsedGroups("k").ids.get().size).toBe(0);
    localStorage.setItem("k", JSON.stringify({ a: 1 }));
    expect(collapsedGroups("k").ids.get().size).toBe(0);
  });

  it("writes the whole set on every toggle", () => {
    const { toggle } = collapsedGroups("k");
    toggle("a");
    toggle("b");
    expect(JSON.parse(localStorage.getItem("k")!)).toEqual(["a", "b"]);
    toggle("a");
    expect(JSON.parse(localStorage.getItem("k")!)).toEqual(["b"]);
  });
});

describe("collapsedGroups with storage blocked", () => {
  it("starts empty and still toggles in memory", () => {
    globalThis.localStorage = blocked;
    const { ids, toggle } = collapsedGroups("k");
    expect(ids.get().size).toBe(0);
    expect(() => toggle("a")).not.toThrow();
    expect(ids.get().has("a")).toBe(true);
  });
});
