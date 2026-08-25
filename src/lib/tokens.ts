// Here rather than in the transport module because both tool models count tokens.

/** Engine-faithful token estimate — approximateTokens() in packages/shared. */
export const tokensOf = (text: string | null | undefined): number =>
  Math.ceil((text ?? "").length / 4);
