// The {{macros}} a preset resolves from its own saved choices.
import type { PromptPreset } from "../api/schema";

/** Expand {{macros}} from the preset's saved choices/variables. */
export function expand(content: string, preset: PromptPreset): string {
  return content.replace(/\{\{([a-z0-9_]+)\}\}/gi, (whole, key: string) => {
    const choice = preset.defaultChoices[key];
    if (choice == null) return whole;                  // {{user}} etc. resolve at runtime
    return Array.isArray(choice) ? choice.join(", ") : choice;
  });
}
