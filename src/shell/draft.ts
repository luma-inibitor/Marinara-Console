// Explicit-save draft buffer.
//
// Replaces the debounced field-at-a-time autosave in both tools. The owner chose
// discrete save; this is the mechanism. Three P0s collapse into it:
//
//  - Rollback stops being something to remember. A rejected save leaves the
//    draft untouched and shows the error; there is no optimistic write to undo.
//  - Concurrency gets one place to check. Every record carries the `updatedAt`
//    it was loaded with; commit refuses if the server's copy moved, instead of
//    last-write-wins clobbering another client.
//  - The fullscreen editor edits the draft rather than the network, so Cancel,
//    Escape and Back can discard without a write ever leaving the browser.
//
// Deliberately NOT a store: one hook per edited record, owned by the surface
// editing it. Nothing here is global.
import { useCallback, useMemo, useRef, useState } from "react";

/** Field-level errors keyed by field name, as the engine reports them. */
type FieldErrors = Record<string, string>;

interface Conflict {
  /** The server's copy, fetched fresh when the precondition failed. */
  theirs: Record<string, unknown>;
  /** Fields where their value differs from the value this draft started at. */
  fields: string[];
}

export interface Draft<T extends { id: string }> {
  /** Base record merged with pending edits — what the UI renders. */
  value: T;
  /** Pending edits only — what a commit would write. */
  patch: Partial<T>;
  dirty: boolean;
  dirtyFields: string[];
  saving: boolean;
  error: string | null;
  fieldErrors: FieldErrors;
  conflict: Conflict | null;
  /** Stage an edit locally. Never touches the network. */
  set: (field: keyof T, value: unknown) => void;
  /** Stage several fields at once (a segmented control writing 3 flags). */
  merge: (patch: Partial<T>) => void;
  /** Write the pending edits, plus `now` on top. A handler that stages and writes in one
   *  gesture must pass its value here: `save` is bound to its render's patch, so a `set`
   *  beside it is not in there yet. */
  save: (now?: Partial<T>) => Promise<boolean>;
  /** Throw away pending edits. */
  cancel: () => void;
  /** Adopt a new base (after a successful save elsewhere, or a refetch). */
  rebase: (next: T) => void;
  /** Resolve a conflict by taking the server's copy as the new base. */
  takeTheirs: () => void;
  /** Resolve a conflict by re-applying this draft's edits over the server copy. */
  keepMine: () => void;
}

/** Pull `{path, message}` pairs out of an engine validation error, if present. */
function parseFieldErrors(err: unknown): FieldErrors {
  const details = (err as { details?: Array<{ path?: string; message?: string }> })?.details;
  if (!Array.isArray(details)) return {};
  const out: FieldErrors = {};
  for (const d of details) if (d?.path && d?.message) out[d.path] = d.message;
  return out;
}

const changed = (a: unknown, b: unknown) => JSON.stringify(a) !== JSON.stringify(b);

export function useDraft<T extends { id: string }>(
  base: T | null,
  opts: {
    /** Persist the patch. Should resolve to the server's updated record. */
    commit: (patch: Partial<T>) => Promise<T>;
    /** Re-read the server's copy, for conflict detection. */
    refetch?: () => Promise<T>;
    /** Field whose change means someone else wrote. Default `updatedAt`. */
    versionField?: keyof T;
  },
): Draft<T> {
  const [patch, setPatch] = useState<Partial<T>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [conflict, setConflict] = useState<Conflict | null>(null);
  const [override, setOverride] = useState<T | null>(null);

  const vf = (opts.versionField ?? "updatedAt") as keyof T;
  const current = override ?? base;

  // The version this draft was loaded at. Captured from the FIRST base we see
  // and held until an explicit rebase — so a background refetch can't silently
  // advance it and mask a conflict.
  const loadedAt = useRef<unknown>(undefined);
  const loadedId = useRef<unknown>(undefined);
  const id = current?.id;
  if (current && loadedId.current !== id) {
    loadedId.current = id;
    loadedAt.current = current[vf];
  }

  const value = useMemo(
    () => (current ? ({ ...current, ...patch } as T) : ({} as T)),
    [current, patch],
  );
  const dirtyFields = Object.keys(patch).filter((k) => current && changed(patch[k as keyof T], current[k as keyof T]));
  const dirty = dirtyFields.length > 0;

  const set = useCallback((field: keyof T, v: unknown) => {
    setPatch((p) => ({ ...p, [field]: v }));
    setFieldErrors((fe) => { const n = { ...fe }; delete n[field as string]; return n; });   // clear on fix
    setError(null);
  }, []);

  const merge = useCallback((p: Partial<T>) => {
    setPatch((prev) => ({ ...prev, ...p }));
    setError(null);
  }, []);

  const cancel = useCallback(() => {
    setPatch({}); setError(null); setFieldErrors({}); setConflict(null);
  }, []);

  const rebase = useCallback((next: T) => {
    setOverride(next); loadedAt.current = next[vf]; loadedId.current = next.id;
    setPatch({}); setError(null); setFieldErrors({}); setConflict(null);
  }, [vf]);

  const save = useCallback(async (now?: Partial<T>): Promise<boolean> => {
    if (!current) return false;
    const pending = { ...patch, ...now };
    if (Object.keys(pending).length === 0) return true;
    setSaving(true); setError(null); setFieldErrors({});
    try {
      // Detect-don't-clobber. The engine has no If-Match, so compare the version
      // we loaded against the server's current one immediately before writing.
      // This is a narrow race, not a lock — but it turns a silent overwrite into
      // a question, which is the whole point.
      if (opts.refetch && loadedAt.current !== undefined) {
        const theirs = await opts.refetch();
        if (changed(theirs[vf], loadedAt.current)) {
          const fields = Object.keys(pending).filter((k) => changed(theirs[k as keyof T], current[k as keyof T]));
          setConflict({ theirs: theirs as Record<string, unknown>, fields });
          setSaving(false);
          return false;
        }
      }
      const saved = await opts.commit(pending);
      setOverride(saved); loadedAt.current = saved[vf]; loadedId.current = saved.id;
      setPatch({}); setSaving(false);
      return true;
    } catch (err) {
      const fe = parseFieldErrors(err);
      setFieldErrors(fe);
      setError((err as Error).message ?? String(err));
      setSaving(false);
      return false;   // draft is preserved — nothing was lost
    }
  }, [current, patch, opts, vf]);

  const takeTheirs = useCallback(() => {
    if (conflict) rebase(conflict.theirs as T);
  }, [conflict, rebase]);

  const keepMine = useCallback(() => {
    if (!conflict) return;
    // Their record becomes the base; our pending edits stay pending on top, so
    // the next save writes only our fields onto their newer copy.
    const keep = { ...patch };
    setOverride(conflict.theirs as T);
    loadedAt.current = (conflict.theirs as T)[vf];
    setConflict(null);
    setPatch(keep);
  }, [conflict, patch, vf]);

  return { value, patch, dirty, dirtyFields, saving, error, fieldErrors, conflict,
    set, merge, save, cancel, rebase, takeTheirs, keepMine };
}
