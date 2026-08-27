import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { dismissToast, isUndoable, toast, toasts } from "./toast";

// Mirrors of toast.ts's own windows: a change there should fail here rather
// than silently shorten the time Undo is on offer.
const UNDO_MS = 9_000;
const INFO_MS = 4_000;

const MSG = "fixture";
const OTHER = "other fixture";

const ttlOf = (id: number) => {
  const t = toasts.get().find((x) => x.id === id);
  if (!t) throw new Error(`no toast ${id}`);
  return t.expiresAt - Date.now();
};

beforeEach(() => {
  vi.useFakeTimers();
  for (const t of toasts.get()) dismissToast(t.id);
});
afterEach(() => vi.useRealTimers());

describe("isUndoable", () => {
  it("is true for a pending commit and for a write that already landed", () => {
    expect(isUndoable({ onExpire: () => {} })).toBe(true);
    expect(isUndoable({ onAction: () => {} })).toBe(true);
    expect(isUndoable({})).toBe(false);
  });
});

describe("undo deadline", () => {
  it("gives an already-landed write the same window as a pending commit", () => {
    const pending = toast(MSG, { actionLabel: "Undo", onAction: () => {}, onExpire: () => {} });
    const landed = toast(OTHER, { actionLabel: "Undo", onAction: () => {} });
    expect(ttlOf(landed)).toBe(UNDO_MS);
    expect(ttlOf(landed)).toBe(ttlOf(pending));
  });

  it("leaves a plain confirmation on the short window", () => {
    expect(ttlOf(toast(MSG))).toBe(INFO_MS);
  });

  it("keeps Undo live past the plain-confirmation window", () => {
    const onAction = vi.fn();
    const id = toast(MSG, { actionLabel: "Undo", onAction });
    vi.advanceTimersByTime(INFO_MS + 500);
    const live = toasts.get().find((x) => x.id === id);
    expect(live).toBeDefined();
    live?.onAction?.();
    expect(onAction).toHaveBeenCalledOnce();
  });

  it("drops the toast once the window is spent", () => {
    const id = toast(MSG, { actionLabel: "Undo", onAction: () => {} });
    vi.advanceTimersByTime(UNDO_MS);
    expect(toasts.get().find((x) => x.id === id)).toBeUndefined();
  });
});

describe("coalescing", () => {
  it("never merges two undoable toasts, so neither undo is lost", () => {
    const a = toast(MSG, { actionLabel: "Undo", onAction: () => {} });
    const b = toast(MSG, { actionLabel: "Undo", onAction: () => {} });
    expect(b).not.toBe(a);
    expect(toasts.get()).toHaveLength(2);
  });

  it("merges plain repeats", () => {
    const a = toast(OTHER);
    expect(toast(OTHER)).toBe(a);
    expect(toasts.get()).toHaveLength(1);
    expect(toasts.get()[0].count).toBe(2);
  });
});

describe("expiry", () => {
  it("fires a pending commit on expiry and not on dismiss", () => {
    const onExpire = vi.fn();
    dismissToast(toast(MSG, { onExpire }));
    expect(onExpire).not.toHaveBeenCalled();
    toast(OTHER, { onExpire });
    vi.advanceTimersByTime(UNDO_MS);
    expect(onExpire).toHaveBeenCalledOnce();
  });
});
