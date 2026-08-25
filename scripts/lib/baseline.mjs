// The baseline ratchet shared by the two dead-code checks. The baseline records
// today's findings and only a finding outside it fails. The file shape follows
// copycheck.mjs and design/copy-baseline.json: keyed by file, sorted item names,
// no line numbers.
//
// Enforcement is per item, never by count. A count lets a new dead export pass
// as long as an old one is deleted in the same change.
import { readFileSync, writeFileSync, existsSync } from "node:fs";

/** The recorded set, or an integrity complaint when it cannot be read. */
export function loadBaseline(path) {
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
 * Split today's findings against the record. `findings` are `{file, item, ...}`.
 * `adopt` records today's set; `prune` only removes entries that no longer
 * appear. `scope` is which files this run looked at: a narrowed run may neither
 * call an entry outside it vanished nor prune it away.
 */
export function ratchet(path, findings, { adopt = false, prune = false, scope = () => true } = {}) {
  const { entries, integrity } = loadBaseline(path);
  const today = group(findings);

  const known = (f) => (entries[f.file] ?? []).includes(f.item);
  const fresh = integrity.length ? [] : findings.filter((f) => !known(f));

  const vanished = [];
  for (const [file, items] of Object.entries(entries)) {
    if (!scope(file)) continue;
    for (const item of items) if (!(today[file] ?? []).includes(item)) vanished.push({ file, item });
  }

  if (!integrity.length && (adopt || prune)) {
    const next = {};
    for (const [file, items] of Object.entries(entries)) {
      const keep = scope(file) ? items.filter((i) => (today[file] ?? []).includes(i)) : items;
      if (keep.length) next[file] = keep;
    }
    if (adopt) for (const [file, items] of Object.entries(today)) next[file] = items;
    const sorted = Object.fromEntries(Object.keys(next).sort().map((k) => [k, next[k]]));
    writeFileSync(path, JSON.stringify(sorted, null, 2) + "\n");
  }

  return { fresh, vanished, integrity, recorded: Object.values(entries).reduce((n, v) => n + v.length, 0) };
}

/** Print what is new, warn about what vanished, and return the exit code. */
export function reportRatchet({ fresh, vanished, integrity, label, noun, adopt, prune }) {
  if (integrity.length) {
    console.log("\nBASELINE INTEGRITY FAILURE — the check itself is compromised:");
    for (const m of integrity) console.log("  " + m);
    return 2;
  }
  // Adopting rewrote the record to today's set, so nothing is left to fail on.
  if (adopt) {
    console.log(`\nbaseline adopted — ${label} now records today's findings`);
    return 0;
  }
  if (prune) console.log(`\nbaseline pruned: ${label}`);

  if (vanished.length) {
    console.log(`\nWARN: ${vanished.length} baseline ${noun}(s) no longer appear (fixed or deleted). Run --prune to drop them.`);
    let last = null;
    for (const v of vanished) {
      if (v.file !== last) { console.log(`  ${v.file}`); last = v.file; }
      console.log(`    ${v.item}`);
    }
  }

  if (!fresh.length) {
    console.log(`\nno ${noun} outside the baseline (${label})`);
    return 0;
  }
  console.log(`\nNEW since the baseline — ${fresh.length} ${noun}(s) not in ${label}:`);
  let last = null;
  for (const f of fresh) {
    if (f.file !== last) { console.log(`  ${f.file}`); last = f.file; }
    console.log(`    ${f.detail ?? f.item}`);
  }
  console.log(`\nFix them, or record them with --adopt and say why in the PR body.`);
  return 1;
}
