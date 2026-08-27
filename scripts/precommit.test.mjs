// The pre-commit hook's one decision: which staged files are safe to rewrite.
// Everything else it does is git and Prettier doing their own jobs.
import { describe, expect, it } from "vitest";
import { partition } from "./precommit.mjs";

describe("partition", () => {
  it("treats a fully staged file as safe to format", () => {
    expect(partition(["a.ts"], [])).toEqual({ safe: ["a.ts"], partial: [] });
  });

  it("holds back a file that is also dirty in the worktree", () => {
    // `git add -p`, or an edit made after staging. Formatting this one and
    // re-adding it would commit the unstaged half too.
    expect(partition(["a.ts"], ["a.ts"])).toEqual({ safe: [], partial: ["a.ts"] });
  });

  it("splits a mixed commit rather than failing whole", () => {
    const { safe, partial } = partition(["a.ts", "b.ts", "c.ts"], ["b.ts"]);
    expect(safe).toEqual(["a.ts", "c.ts"]);
    expect(partial).toEqual(["b.ts"]);
  });

  it("ignores worktree changes to files nobody staged", () => {
    expect(partition(["a.ts"], ["z.ts"])).toEqual({ safe: ["a.ts"], partial: [] });
  });

  it("has nothing to do for an empty stage", () => {
    expect(partition([], ["a.ts"])).toEqual({ safe: [], partial: [] });
  });
});
