// First-party (the rest of src/lib is vendored engine code).
// Module-scope stores over useSyncExternalStore.
//
// There is deliberately no `.value`. A store is read one of two ways, and the
// type system forces you to say which: `useStore(s)` inside a component (this
// subscribes), or `s.get()` anywhere else (this does not). Reading a value in a
// component body without subscribing is a silent no-re-render bug, so the shape
// that permits it does not exist. Do not add one.
//
// The import below is the ONLY line that changes when preact/compat is swapped
// for react.
import { useSyncExternalStore } from "preact/compat";

type Listener = () => void;

export interface Store<T> {
  get(): T;
  subscribe(fn: Listener): () => void;
}

export interface Writable<T> extends Store<T> {
  set(next: T): void;
  update(fn: (prev: T) => T): void;
}

export function createStore<T>(initial: T): Writable<T> {
  let value = initial;
  const listeners = new Set<Listener>();
  const set = (next: T) => {
    if (Object.is(next, value)) return;
    value = next;
    for (const l of [...listeners]) l();
  };
  return {
    get: () => value,
    set,
    update: (fn) => set(fn(value)),
    subscribe: (fn) => (listeners.add(fn), () => void listeners.delete(fn)),
  };
}

type Values<S> = { [K in keyof S]: S[K] extends Store<infer V> ? V : never };

/** computed(): recomputed eagerly on source change so get() is O(1) and returns
 *  a stable reference — useSyncExternalStore requires that of getSnapshot. */
export function derived<const S extends readonly Store<unknown>[], T>(
  sources: S,
  compute: (...values: Values<S>) => T,
): Store<T> {
  const listeners = new Set<Listener>();
  const read = () => compute(...(sources.map((s) => s.get()) as unknown as Values<S>));
  let value = read();
  for (const s of sources) {
    s.subscribe(() => {
      const next = read();
      if (Object.is(next, value)) return;
      value = next;
      for (const l of [...listeners]) l();
    });
  }
  return {
    get: () => value,
    subscribe: (fn) => (listeners.add(fn), () => void listeners.delete(fn)),
  };
}

/** Subscribing read. The only legal way to read a store inside a component. */
export function useStore<T>(store: Store<T>): T {
  // No getServerSnapshot third argument: preact/compat's signature does not
  // accept one, and this app never server-renders.
  return useSyncExternalStore(store.subscribe, store.get);
}
