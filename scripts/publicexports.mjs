#!/usr/bin/env node
// List every export carrying a `/** @public */` tag, which knip reads as a use and never prints.
//
//   node scripts/publicexports.mjs
//   node scripts/publicexports.mjs src/ui
//
// Inventory, not a gate: this always exits 0.
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const ROOTS = ["src", "scripts", "server.mjs"];
const SKIP_DIRS = /(^|\/)(node_modules|dist|\.git|vendor|fixtures)$/;
const SOURCE = /\.(tsx?|mjs|jsx?)$/;

const rel = (p) => relative(ROOT, p).split(sep).join("/");

function sources(roots) {
  const out = [];
  const visit = (p) => {
    if (!existsSync(p)) return;
    if (statSync(p).isDirectory()) {
      if (SKIP_DIRS.test(p.split(sep).join("/"))) return;
      for (const f of readdirSync(p).sort()) visit(join(p, f));
      return;
    }
    if (SOURCE.test(p) && !/\.d\.ts$/.test(p)) out.push(p);
  };
  for (const r of roots) visit(resolve(ROOT, r));
  return out;
}

const uncomment = (line) => line.replace(/^\s*\/\*.*?\*\//, "");

function namesOn(line) {
  const braced = line.match(/^\s*export\s+(?:type\s+)?\{([^}]*)\}/);
  if (braced) {
    return braced[1]
      .split(",")
      .map((part) => part.trim().replace(/^type\s+/, "").split(/\s+as\s+/).pop())
      .filter(Boolean);
  }
  const declared = line.match(
    /^\s*export\s+(?:default\s+)?(?:declare\s+)?(?:async\s+)?(?:function\*?|class|const|let|var|interface|type|enum)\s+([A-Za-z_$][\w$]*)/,
  );
  return declared ? [declared[1]] : [];
}

const findings = [];
const args = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const files = sources(args.length ? args : ROOTS);
for (const file of files) {
  const lines = readFileSync(file, "utf8").split("\n");
  for (let i = 0; i < lines.length; i++) {
    if (!/^\s*(?:\/\*|\*)/.test(lines[i]) || !/@public\b/.test(lines[i])) continue;
    let j = i;
    while (j < lines.length && !/^\s*export\b/.test(uncomment(lines[j]))) j++;
    const names = j < lines.length ? namesOn(uncomment(lines[j])) : [];
    findings.push({ file: rel(file), line: j + 1, names: names.length ? names : ["(no export below the tag)"] });
  }
}

console.log(`publicexports · ${files.length} file(s) · ${findings.length} tagged export(s)`);
if (!findings.length) {
  console.log("no `/** @public */` tag in the tree");
  process.exit(0);
}
console.log("knip treats each of these as used. Removing the tag puts the symbol back in its report.");
const width = Math.max(...findings.map((f) => f.names.join(", ").length));
for (const f of findings) {
  console.log(`  ${f.names.join(", ").padEnd(width)}  ${f.file}:${f.line}`);
}
process.exit(0);
