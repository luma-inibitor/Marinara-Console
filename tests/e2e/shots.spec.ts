// Screen captures of one address at the four standard viewports, for mockup and
// wireframe review.

import { test } from "./harness";

// tests/ is type-checked without @types/node, so the one Node global this file
// reads is declared here rather than added to the compiler's `types` list.
declare const process: { env: Record<string, string | undefined> };

const OUT = "/tmp/shots";

test.skip(process.env.MC_SHOTS !== "1", "set MC_SHOTS=1 to capture screen images");

test("capture", async ({ page }, info) => {
  const url = process.env.MC_SHOT_URL;
  if (!url) throw new Error("set MC_SHOT_URL to the address to capture");
  const name = process.env.MC_SHOT_NAME ?? "shot";
  const sel = process.env.MC_SHOT_SEL;

  // Gotcha: the fixture router matches on pathname alone, so an absolute URL
  // pointed at a live server still has its /api/ and /console/ requests answered
  // from the corpus.
  await page.goto(url, { waitUntil: "networkidle", timeout: 90_000 });
  await page.waitForTimeout(700);

  const path = `${OUT}/${name}-${info.project.name}.png`;
  if (sel) await page.locator(sel).first().screenshot({ path });
  else await page.screenshot({ path, fullPage: !!process.env.MC_SHOT_FULL });

  const over = await page.evaluate(() => {
    const d = document.documentElement;
    const wide = [...document.querySelectorAll("*")]
      .filter((el) => el.getBoundingClientRect().right > d.clientWidth + 1)
      .slice(0, 5)
      .map((el) => (el.className || el.tagName).toString().slice(0, 40));
    return { scrollW: d.scrollWidth, clientW: d.clientWidth, wide };
  });
  const overflowing = over.scrollW > over.clientW + 1;
  console.log(`${info.project.name.padEnd(8)} → ${path}` +
    (overflowing ? `  OVERFLOW ${over.scrollW}>${over.clientW}: ${over.wide.join(", ")}` : ""));
});
