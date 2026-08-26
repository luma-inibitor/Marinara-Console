// An enum-to-label map under an ALL-CAPS name, which eslint-plugin-i18next
// skips whole. The copy-table selector is what reports the label; the catalog
// keys beside it must stay silent.
import { tAny } from "../../../src/copy";

export const ZORPLE_LABELS: Record<string, string> = {
  untraced: "Zorple label here",
  traced: "zorple.label.key",
};

export const zorpleLabel = (k: string): string => tAny(ZORPLE_LABELS[k] ?? "");
