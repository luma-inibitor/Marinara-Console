import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { useDraft, type Draft } from "./draft";

interface Rec { id: string; updatedAt: string; wrapFormat: string }

const BASE: Rec = { id: "p1", updatedAt: "2026-01-01T00:00:00.000Z", wrapFormat: "xml" };

/**
 * One render, and the draft it produced. State updates after it are inert, which
 * is exactly the situation a click handler is in: it holds the draft of the render
 * it was created in, and a `set` beside it will not be in that draft's patch.
 */
function rendered(commit: (patch: Partial<Rec>) => Promise<Rec>): Draft<Rec> {
  let draft!: Draft<Rec>;
  const Probe = () => { draft = useDraft<Rec>(BASE, { commit }); return null; };
  renderToStaticMarkup(createElement(Probe));
  return draft;
}

describe("useDraft save", () => {
  it("writes the value it is handed rather than the render's patch", async () => {
    const writes: Array<Partial<Rec>> = [];
    const draft = rendered(async (patch) => { writes.push(patch); return { ...BASE, ...patch }; });

    draft.set("wrapFormat", "markdown");
    expect(await draft.save({ wrapFormat: "markdown" })).toBe(true);

    expect(writes).toEqual([{ wrapFormat: "markdown" }]);
  });

  it("has nothing to write when the same handler only stages", async () => {
    const writes: Array<Partial<Rec>> = [];
    const draft = rendered(async (patch) => { writes.push(patch); return { ...BASE, ...patch }; });

    draft.set("wrapFormat", "markdown");
    await draft.save();

    expect(writes).toEqual([]);
  });
});
