import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

export { cva, type VariantProps } from "class-variance-authority";

/** The theme.css scales tailwind-merge would otherwise read as a colour or a weight. */
export const THEME = {
  text: ["label-s", "label", "data-s", "data", "data-l", "prose", "title", "head"],
  font: ["label", "data", "prose"],
  radius: ["sm", "md", "lg"],
  shadow: ["pop", "panel", "modal"],
  spacing: ["1", "2", "3", "4", "5", "6", "tap", "tap-2", "row-x", "row-y"],
};

const merge = extendTailwindMerge({ extend: { theme: THEME } });

/** Joins class inputs and lets the last utility win when two set the same property. */
export function cn(...inputs: ClassValue[]) {
  return merge(clsx(inputs));
}
