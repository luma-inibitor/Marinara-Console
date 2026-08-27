#!/usr/bin/env node
// Every script and npm script the instructing documents name must exist.
//
//   node scripts/docrefs.mjs
//
// BACKLOG.md is out of scope: it records what was measured on a given day, and
// it quotes other projects' file names.
//
// Exit codes: 0 clean · 1 a name with nothing behind it · 2 the check itself
// could not read its inputs.
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

export function docRefs(root = ROOT) {
  const design = join(root, "design");
  const docs = [
    "README.md",
    "CLAUDE.md",
    ...(existsSync(design) ? readdirSync(design).filter((f) => f.endsWith(".md")).map((f) => join("design", f)) : []),
  ].filter((f) => existsSync(join(root, f)));

  if (!docs.length) return { findings: [], docs, integrity: ["no documents to read"] };

  const scripts = Object.keys(JSON.parse(readFileSync(join(root, "package.json"), "utf8")).scripts ?? {});
  const findings = [];
  for (const doc of docs) {
    const text = readFileSync(join(root, doc), "utf8");
    for (const [, file] of text.matchAll(/`?(scripts\/[a-z0-9-]+\.mjs)`?/g)) {
      if (!existsSync(join(root, file))) findings.push({ doc, name: file });
    }
    for (const [, task] of text.matchAll(/`npm run ([a-z][a-z0-9:-]*)`/g)) {
      if (!scripts.includes(task)) findings.push({ doc, name: `npm run ${task}` });
    }
  }
  return { findings, docs, integrity: [] };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  let r;
  try {
    r = docRefs();
  } catch (e) {
    console.log(`DOCREFS INTEGRITY FAILURE — ${e.message}`);
    process.exit(2);
  }
  if (r.integrity.length) {
    console.log(`DOCREFS INTEGRITY FAILURE — ${r.integrity.join("; ")}`);
    process.exit(2);
  }
  console.log(`docrefs · ${r.docs.length} document(s)`);
  for (const f of r.findings) console.log(`  ${f.doc}: ${f.name} does not exist`);
  console.log(r.findings.length ? `\n${r.findings.length} name(s) with nothing behind them` : "\nevery named script exists");
  process.exit(r.findings.length ? 1 : 0);
}
