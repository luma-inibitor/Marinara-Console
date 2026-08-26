// eslint-plugin-i18next reads a fixed five-attribute list, so the four aria
// attributes that also hold sentences are covered by a no-restricted-syntax
// selector instead. A rule without a fixture is a rule that can be disabled by
// an edit and stay green.
import { describe, expect, it } from "vitest";
import { ESLint } from "eslint";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

// The fixture is linted under a src/ path because that is where the copy rules
// are configured; scripts/fixtures/ is deliberately outside every rule block.
async function lintFixture(name) {
  const text = readFileSync(join(ROOT, "scripts", "fixtures", "eslint", name), "utf8");
  const eslint = new ESLint({ cwd: ROOT });
  const [result] = await eslint.lintText(text, { filePath: join(ROOT, "src", name) });
  return result.messages;
}

describe("copy in an aria attribute the i18next plugin cannot see", () => {
  it("reports each of the four, and nothing on the t() calls beside them", async () => {
    const messages = await lintFixture("aria.tsx");
    expect(messages.map((m) => `${m.line} ${m.ruleId} ${m.message}`)).toEqual([
      "7 no-restricted-syntax aria text must come from t()",
      "8 no-restricted-syntax aria text must come from t()",
      "9 no-restricted-syntax aria text must come from t()",
      "10 no-restricted-syntax aria text must come from t()",
    ]);
  });
});
