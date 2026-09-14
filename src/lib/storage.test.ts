import { afterEach, describe, expect, it } from "vitest";
import { readStorage, writeStorage } from "./storage";

const real = globalThis.localStorage;

afterEach(() => {
  globalThis.localStorage = real;
  localStorage.clear();
});

const throwingMethods = {
  getItem() {
    throw new Error("blocked");
  },
  setItem() {
    throw new Error("quota");
  },
} as unknown as Storage;

const throwingAccess = new Proxy({} as Storage, {
  get() {
    throw new Error("SecurityError");
  },
});

describe("readStorage / writeStorage", () => {
  it("round-trips through a working store", () => {
    writeStorage("k", "v");
    expect(readStorage("k")).toBe("v");
    expect(localStorage.getItem("k")).toBe("v");
  });

  it("reads null for a missing key", () => {
    expect(readStorage("missing")).toBeNull();
  });

  it("reads null when getItem throws", () => {
    globalThis.localStorage = throwingMethods;
    expect(readStorage("k")).toBeNull();
  });

  it("drops the write when setItem throws", () => {
    globalThis.localStorage = throwingMethods;
    expect(() => writeStorage("k", "v")).not.toThrow();
  });

  it("degrades when the store throws on access", () => {
    globalThis.localStorage = throwingAccess;
    expect(readStorage("k")).toBeNull();
    expect(() => writeStorage("k", "v")).not.toThrow();
  });
});
