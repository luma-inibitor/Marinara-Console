// One fixture per copy rule eslint-plugin-i18next cannot express: the four aria
// attributes, the three literals its excludes admit, and the copy tables.
import { describe, expect, it } from "vitest";
import { ESLint } from "eslint";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

// A fixture is linted under a src/ path because that is where the copy rules
// are configured; scripts/fixtures/ is deliberately outside every rule block.
async function lintFixture(name, as = `src/${name}`) {
  const text = readFileSync(join(ROOT, "scripts", "fixtures", "eslint", name), "utf8");
  const eslint = new ESLint({ cwd: ROOT });
  const [result] = await eslint.lintText(text, { filePath: join(ROOT, as) });
  return result.messages.map((m) => `${m.line} ${m.ruleId} ${m.message}`);
}

describe("copy in an aria attribute the i18next plugin cannot see", () => {
  it("reports each of the four, and nothing on the t() calls beside them", async () => {
    expect(await lintFixture("aria.tsx")).toEqual([
      "7 no-restricted-syntax aria text must come from t()",
      "8 no-restricted-syntax aria text must come from t()",
      "9 no-restricted-syntax aria text must come from t()",
      "10 no-restricted-syntax aria text must come from t()",
    ]);
  });
});

describe("copy the i18next plugin's default excludes would let through", () => {
  it("reports the ALL-CAPS word, the camelCase JSX text and the one-word attribute", async () => {
    expect(await lintFixture("copy.tsx")).toEqual([
      "8 i18next/no-literal-string disallow literal string: <span>ZORPLE</span>",
      "9 no-restricted-syntax a bare word in JSX text must come from t()",
      "10 no-restricted-syntax a one-word copy attribute must come from t()",
    ]);
  });
});

describe("a label in a copy table under an ALL-CAPS name", () => {
  const table = ["7 no-restricted-syntax a label in a copy table must come from t()"];

  it("is reported in each of the two files eslint.config.js names", async () => {
    expect(await lintFixture("copytable.ts", "src/tools/lorebooks/data.ts")).toEqual(table);
    expect(await lintFixture("copytable.ts", "src/tools/presets/data.ts")).toEqual(table);
  });

  it("is not reported elsewhere, because the block is scoped to those two paths", async () => {
    expect(await lintFixture("copytable.ts", "src/tools/other/data.ts")).toEqual([]);
  });
});
