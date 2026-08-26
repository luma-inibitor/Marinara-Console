// The type scale rule: a `font-size` must name a --fs-* token, not a number.
//
// Gotcha: the message is `<selector> → <value>`, three spaces, then how the
// value stands against the scale. scripts/typescale.mjs splits it at those
// three spaces to key its baseline, so the halves must stay separable.
import { readFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import stylelint from "stylelint";

const ruleName = "marinara/font-size-token";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const TOKENS = join(ROOT, "src", "styles", "tokens.css");

/** The scale, parsed from src/styles/tokens.css. */
export function loadScale() {
  let css;
  try {
    css = readFileSync(TOKENS, "utf8");
  } catch (e) {
    return { steps: new Map(), integrity: [`${relative(ROOT, TOKENS)} is unreadable: ${e.message}`] };
  }
  // value -> every token that carries it: --fs-data-l and --fs-prose are both
  // 14px, and the density block redefines some, so a plain Map would name only
  // the last token holding a size.
  const steps = new Map();
  for (const m of css.matchAll(/(--fs-[a-z0-9-]+)\s*:\s*([^;]+);/g)) {
    const value = m[2].trim();
    if (!steps.has(value)) steps.set(value, new Set());
    steps.get(value).add(m[1]);
  }
  // No steps means the token file moved or its naming changed, which would
  // read as every font-size in the tree going off-scale at once.
  const integrity = steps.size
    ? []
    : [`${relative(ROOT, TOKENS)} declares no --fs-* tokens; the scale could not be read`];
  return { steps, integrity };
}

function selectorOf(decl) {
  const parts = [];
  for (let node = decl.parent; node && node.type !== "root"; node = node.parent) {
    if (node.type === "rule") parts.unshift(node.selector.replace(/\s+/g, " ").trim());
    else if (node.type === "atrule") parts.unshift(`@${node.name} ${node.params}`.replace(/\s+/g, " ").trim());
  }
  return parts.join(" ") || "(top level)";
}

const rule = (primary) => (root, result) => {
  if (!stylelint.utils.validateOptions(result, ruleName, { actual: primary, possible: [true] })) return;
  const { steps } = loadScale();
  root.walkDecls(/^font-size$/i, (decl) => {
    const value = decl.value.replace(/\s+/g, " ").trim();
    if (/^var\(\s*--fs-/.test(value)) return;
    const tokens = steps.get(value);
    const standing = tokens ? `(on the scale — use ${[...tokens].sort().join(" or ")})` : "OFF THE SCALE";
    stylelint.utils.report({
      result,
      ruleName,
      node: decl,
      message: `${selectorOf(decl)} → ${value}   ${standing}`,
    });
  });
};

rule.ruleName = ruleName;

export default stylelint.createPlugin(ruleName, rule);
