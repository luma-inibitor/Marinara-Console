// The two failure modes, pinned: an envelope mismatch throws, an element
// mismatch drops that element and keeps the rest, and neither is silent.
//
// Copy is stubbed to `key|param=value`, so what these assert is the catalog
// key a person would see rather than the sentence — rewording shell.json must
// not fail them.

import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../copy", () => ({
  t: (key: string, params?: Record<string, unknown>) =>
    params && Object.keys(params).length
      ? `${key}|${Object.entries(params).map(([k, v]) => `${k}=${v}`).join(",")}`
      : key,
}));

const raised: Array<{ message: string; kind?: string }> = [];
vi.mock("./toast", () => ({
  toast: (message: string, opts?: { kind?: string }) => {
    raised.push({ message, kind: opts?.kind });
    return 0;
  },
}));

import * as v from "valibot";
import { parseItems, parseWire, WireMismatchError } from "./wire";

const Thing = v.looseObject({ id: v.string(), on: v.boolean() });

/** The toast is raised from a lazy `import()`, so it lands a microtask after
 *  the call that caused it. */
const settled = () => new Promise((resolve) => setTimeout(resolve, 0));

// Flush before clearing: a test that does not wait still leaves its toast in
// flight, and it would otherwise land in the next test's list.
afterEach(async () => {
  await settled();
  raised.length = 0;
  vi.restoreAllMocks();
});

describe("parseWire", () => {
  it("returns the value when it matches", () => {
    expect(parseWire(Thing, { id: "a", on: true }, "GET /thing")).toEqual({ id: "a", on: true });
  });

  it("passes fields the schema does not name straight through", () => {
    const parsed = parseWire(Thing, { id: "a", on: true, addedUpstream: 7 }, "GET /thing");
    expect(parsed.addedUpstream).toBe(7);
  });

  it("throws on a mismatch, naming the field", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    let thrown: unknown;
    try { parseWire(Thing, { id: "a", on: "false" }, "GET /thing"); } catch (e) { thrown = e; }
    expect(thrown).toBeInstanceOf(WireMismatchError);
    expect((thrown as WireMismatchError).issues.join(" ")).toContain("on");
    expect((thrown as WireMismatchError).context).toBe("GET /thing");
  });

  // The precedent this whole module exists for: `"false"` is truthy, so an
  // engine that starts sending booleans as strings reads as `true` everywhere.
  it("rejects a boolean sent as the string \"false\" rather than believing it", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => parseWire(Thing, { id: "a", on: "false" }, "GET /thing")).toThrow(WireMismatchError);
  });

  it("reports the mismatch to the console and to a toast", async () => {
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => parseWire(Thing, { id: "a" }, "GET /thing")).toThrow();
    await settled();
    expect(logged).toHaveBeenCalled();
    expect(raised).toEqual([{ message: "shell.wire.mismatch|context=GET /thing", kind: "error" }]);
  });
});

describe("parseItems", () => {
  it("returns every element when they all match", () => {
    const items = [{ id: "a", on: true }, { id: "b", on: false }];
    expect(parseItems(Thing, items, "GET /things")).toEqual(items);
  });

  it("keeps the good elements and drops the bad one", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const kept = parseItems(Thing, [{ id: "a", on: true }, { id: "b" }, { id: "c", on: false }], "GET /things");
    expect(kept.map((k) => k.id)).toEqual(["a", "c"]);
    await settled();
    expect(raised).toEqual([{ message: "shell.wire.dropped|count=1,context=GET /things", kind: "error" }]);
  });

  it("counts every dropped element in the one report", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    parseItems(Thing, [{ id: "a" }, { id: "b" }], "GET /things");
    await settled();
    expect(raised).toEqual([{ message: "shell.wire.dropped|count=2,context=GET /things", kind: "error" }]);
  });

  it("says nothing when nothing was dropped", async () => {
    parseItems(Thing, [{ id: "a", on: true }], "GET /things");
    await settled();
    expect(raised).toEqual([]);
  });

  it("throws when the response is not a list at all", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => parseItems(Thing, { id: "a", on: true }, "GET /things")).toThrow(WireMismatchError);
    await settled();
    expect(raised).toEqual([{ message: "shell.wire.mismatch|context=GET /things", kind: "error" }]);
  });
});
