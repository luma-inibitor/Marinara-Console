// The baseline ratchet, shared by the two dead-code checks: record today's
// findings, fail only on the ones that are not in the record.
//
// The record lives under design/, keyed by FILE, and holds sorted item names
// with no line numbers so ordinary edits do not churn it. `--adopt` records
// today's findings and `--prune` retires the ones that have gone.
//
// Enforcement is PER ITEM, never by count. A count lets a new dead export pass
// as long as an old one is deleted in the same change, which is the defect the
// check exists to catch.
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";

/** The recorded set, or an integrity complaint when it cannot be read. */
function loadBaseline(path) {
  if (!existsSync(path)) return { entries: {}, integrity: [] };
  try {
    const parsed = JSON.parse(readFileSync(path, "utf8"));
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return { entries: {}, integrity: [`${path} is not an object`] };
    }
    const entries = {};
    for (const [file, items] of Object.entries(parsed)) {
      if (!Array.isArray(items) || items.some((i) => typeof i !== "string")) {
        return { entries: {}, integrity: [`${path}: "${file}" is not an array of strings`] };
      }
      entries[file] = items;
    }
    return { entries, integrity: [] };
  } catch (e) {
    return { entries: {}, integrity: [`${path} is unreadable: ${e.message}`] };
  }
}

const group = (findings) => {
  const out = {};
  for (const f of findings) (out[f.file] ??= new Set()).add(f.item);
  return Object.fromEntries(Object.entries(out).map(([k, v]) => [k, [...v].sort()]));
};

/**
 * Split today's findings against the record. `findings` are `{file, item, ...}`;
 * the extra fields ride along untouched so a caller can still print line numbers.
 *
 * `--adopt` records today's set; `--prune` only ever REMOVES entries that no
 * longer appear. Neither grows the record as a side effect of a normal run.
 *
 * `scope` is which files this run was answerable for. A narrowed run
 * (`deadexports src/ui`) saw nothing of the rest of the tree, so it may neither
 * call those entries vanished nor prune them away.
 *
 * A file that has left the tree is the exception: no run of any scope can
 * reproduce its findings, so scope does not shelter it. `root` is what the
 * recorded paths are relative to.
 */
export function ratchet(path, findings, { adopt = false, prune = false, scope = () => true, root = process.cwd() } = {}) {
  const { entries, integrity } = loadBaseline(path);
  const today = group(findings);

  const known = (f) => (entries[f.file] ?? []).includes(f.item);
  const fresh = integrity.length ? [] : findings.filter((f) => !known(f));

  const answerable = (file) => scope(file) || !existsSync(join(root, file));

  const vanished = [];
  for (const [file, items] of Object.entries(entries)) {
    if (!answerable(file)) continue;
    for (const item of items) if (!(today[file] ?? []).includes(item)) vanished.push({ file, item });
  }

  if (!integrity.length && (adopt || prune)) {
    const next = {};
    for (const [file, items] of Object.entries(entries)) {
      const keep = answerable(file) ? items.filter((i) => (today[file] ?? []).includes(i)) : items;
      if (keep.length) next[file] = keep;
    }
    if (adopt) for (const [file, items] of Object.entries(today)) next[file] = items;
    const sorted = Object.fromEntries(Object.keys(next).sort().map((k) => [k, next[k]]));
    writeFileSync(path, JSON.stringify(sorted, null, 2) + "\n");
  }

  return { fresh, vanished, integrity, recorded: Object.values(entries).reduce((n, v) => n + v.length, 0) };
}

/**
 * The shared tail of both checks: print what is new, warn about what vanished,
 * and pick the exit code. 2 means the check itself is compromised and must
 * never read as a pass.
 */
export function reportRatchet({ fresh, vanished, integrity, label, noun, adopt, prune, vanishedFails = false, adoptFlag = "--adopt", pruneFlag = "--prune" }) {
  if (integrity.length) {
    console.log("\nBASELINE INTEGRITY FAILURE — the check itself is compromised:");
    for (const m of integrity) console.log("  " + m);
    return 2;
  }
  // Adopting rewrites the record to today's set, so there is nothing left
  // outside it to fail on and the run reports what it wrote instead.
  if (adopt) {
    console.log(`\nbaseline adopted — ${label} now records today's findings`);
    return 0;
  }
  if (prune) console.log(`\nbaseline pruned: ${label}`);

  const stale = vanished.length && vanishedFails && !prune;
  if (vanished.length) {
    const head = stale ? "GONE FROM THE TREE" : "WARN";
    console.log(`\n${head}: ${vanished.length} baseline ${noun}(s) no longer appear (fixed or deleted). Run ${pruneFlag} to drop them.`);
    let last = null;
    for (const v of vanished) {
      if (v.file !== last) { console.log(`  ${v.file}`); last = v.file; }
      console.log(`    ${v.item}`);
    }
  }

  if (!fresh.length) {
    if (stale) return 1;
    console.log(`\nno ${noun} outside the baseline (${label})`);
    return 0;
  }
  console.log(`\nNEW since the baseline — ${fresh.length} ${noun}(s) not in ${label}:`);
  let last = null;
  for (const f of fresh) {
    if (f.file !== last) { console.log(`  ${f.file}`); last = f.file; }
    console.log(`    ${f.detail ?? f.item}`);
  }
  console.log(`\nFix them, or record them with ${adoptFlag} and say why in the PR body.`);
  return 1;
}
