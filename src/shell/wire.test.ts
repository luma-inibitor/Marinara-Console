// Pins the failure contract in wire.ts. Copy is stubbed to `key|param=value`
// so the assertions name catalog keys rather than English.

import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../copy", () => ({
  t: (key: string, params?: Record<string, unknown>) =>
    params && Object.keys(params).length
      ? `${key}|${Object.entries(params)
          .map(([k, v]) => `${k}=${v}`)
          .join(",")}`
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
import { parseItems, parseWire, parseWrite, WireMismatchError } from "./wire";

const Thing = v.looseObject({ id: v.string(), on: v.boolean() });

afterEach(() => {
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
    try {
      parseWire(Thing, { id: "a", on: "false" }, "GET /thing");
    } catch (e) {
      thrown = e;
    }
    expect(thrown).toBeInstanceOf(WireMismatchError);
    expect((thrown as WireMismatchError).issues.join(" ")).toContain("on");
    expect((thrown as WireMismatchError).context).toBe("GET /thing");
  });

  // `"false"` is truthy, so believing it reads as `true` everywhere.
  it('rejects a boolean sent as the string "false" rather than believing it', () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => parseWire(Thing, { id: "a", on: "false" }, "GET /thing")).toThrow(WireMismatchError);
  });

  it("reports the mismatch to the console and to a toast", () => {
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => parseWire(Thing, { id: "a" }, "GET /thing")).toThrow();
    expect(logged).toHaveBeenCalled();
    expect(raised).toEqual([{ message: "shell.wire.mismatch|context=GET /thing", kind: "error" }]);
  });
});

describe("parseWrite", () => {
  it("returns the value when it matches", () => {
    expect(parseWrite(Thing, { id: "a", on: true }, "PATCH /thing")).toEqual({ id: "a", on: true });
  });

  it("throws rather than returning a partial write", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => parseWrite(Thing, { id: "a" }, "PATCH /thing")).toThrow(WireMismatchError);
  });

  it("carries copy saying the change was made, for the caller to report", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    let thrown: unknown;
    try {
      parseWrite(Thing, { id: "a" }, "PATCH /thing");
    } catch (e) {
      thrown = e;
    }
    expect((thrown as Error).message).toBe("shell.wire.writeMismatch|context=PATCH /thing");
  });

  it("logs the issues but raises no toast of its own", () => {
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => parseWrite(Thing, { id: "a" }, "PATCH /thing")).toThrow();
    expect(logged).toHaveBeenCalled();
    expect(raised).toEqual([]);
  });
});

describe("parseItems", () => {
  it("returns every element when they all match", () => {
    const items = [
      { id: "a", on: true },
      { id: "b", on: false },
    ];
    expect(parseItems(Thing, items, "GET /things")).toEqual(items);
  });

  it("keeps the good elements and drops the bad one", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const kept = parseItems(Thing, [{ id: "a", on: true }, { id: "b" }, { id: "c", on: false }], "GET /things");
    expect(kept.map((k) => k.id)).toEqual(["a", "c"]);
    expect(raised).toEqual([{ message: "shell.wire.dropped|count=1,context=GET /things", kind: "error" }]);
  });

  it("counts every dropped element in the one report", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    parseItems(Thing, [{ id: "a" }, { id: "b" }], "GET /things");
    expect(raised).toEqual([{ message: "shell.wire.dropped|count=2,context=GET /things", kind: "error" }]);
  });

  it("says nothing when nothing was dropped", () => {
    parseItems(Thing, [{ id: "a", on: true }], "GET /things");
    expect(raised).toEqual([]);
  });

  it("throws when the response is not a list at all", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => parseItems(Thing, { id: "a", on: true }, "GET /things")).toThrow(WireMismatchError);
    expect(raised).toEqual([{ message: "shell.wire.mismatch|context=GET /things", kind: "error" }]);
  });
});
