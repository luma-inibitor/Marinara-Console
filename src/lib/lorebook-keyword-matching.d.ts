// Types for the verbatim-vendored engine matcher (packages/shared/src/utils/).
export interface KeywordMatchOptions {
  useRegex: boolean;
  matchWholeWords: boolean;
  caseSensitive: boolean;
}
export type SelectiveLogic = "and" | "and_all" | "or" | "not" | "not_all";
export function testKeyword(keyword: string, text: string, options: KeywordMatchOptions): boolean;
export function testPrimaryKeys(
  keys: string[], text: string, options: KeywordMatchOptions,
): { matched: boolean; matchedKeys: string[] };
export function testSecondaryKeys(
  secondaryKeys: string[], text: string, logic: SelectiveLogic, options: KeywordMatchOptions,
): boolean;
