// The dev-only load assertions in ./index.ts run on import. This owns that import.
import { expect, it } from "vitest";
import { t } from "./index";

it("loads without a console key shadowing a product key or a mirror pointing nowhere", () => {
  expect(t("memoryvault.title")).toBe("Title");
});
