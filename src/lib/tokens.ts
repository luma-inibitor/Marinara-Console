// A token estimate is arithmetic over a string, not a request, and the model
// layer counts tokens without being allowed to reach the transport that used
// to hold this (ARCHITECTURE.md §1). It lives here so both can have it.

/** Engine-faithful token estimate — approximateTokens() in packages/shared. */
export const tokensOf = (text: string | null | undefined): number =>
  Math.ceil((text ?? "").length / 4);
