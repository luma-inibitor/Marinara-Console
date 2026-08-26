// The shape of src/tools/memory/test/factories.ts: `draft-` composes an
// identifier, not a class name, and no stylesheet has a .draft-* rule to lose.
export const draftId = (n: number) => `draft-${n}`;
