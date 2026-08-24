// The scope store reads persisted scope at import time, so the node
// environment needs somewhere for that read to land. A Map is the whole
// requirement: nothing under test depends on storage surviving a reload, only
// on the API existing.

class MemoryStorage implements Storage {
  private map = new Map<string, string>();
  get length() {
    return this.map.size;
  }
  key(i: number) {
    return [...this.map.keys()][i] ?? null;
  }
  getItem(k: string) {
    return this.map.get(k) ?? null;
  }
  setItem(k: string, v: string) {
    this.map.set(k, String(v));
  }
  removeItem(k: string) {
    this.map.delete(k);
  }
  clear() {
    this.map.clear();
  }
}

if (typeof globalThis.localStorage === "undefined") {
  Object.defineProperty(globalThis, "localStorage", { value: new MemoryStorage(), writable: true });
}

// The review store registers `visibilitychange` and `pagehide` listeners at
// module scope to flush pending persists, so importing anything that reaches it
// needs both objects to exist. Only the registration is required — nothing here
// dispatches these events, and a test that wanted to would install its own
// listener rather than drive them through these stubs.
const noopEvents = {
  addEventListener() {},
  removeEventListener() {},
};

if (typeof globalThis.document === "undefined") {
  Object.defineProperty(globalThis, "document", {
    value: { ...noopEvents, visibilityState: "visible" },
    writable: true,
  });
}
if (typeof globalThis.window === "undefined") {
  Object.defineProperty(globalThis, "window", { value: { ...noopEvents }, writable: true });
}
