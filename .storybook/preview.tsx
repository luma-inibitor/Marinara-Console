import { useEffect } from "react";
import type { Decorator, Preview } from "@storybook/react-vite";

// The same stylesheets src/main.tsx loads, in the same order.
import "@fontsource-variable/archivo/wdth.css";
import "@fontsource-variable/jetbrains-mono";
import "@fontsource-variable/source-sans-3";
import "../src/styles/tokens.css";
import "../src/styles/theme.css";
import "../src/styles/base.css";
import "../src/styles/shell.css";
import "../src/styles/lorebooks.css";
import "../src/styles/presets.css";
import "../src/styles/memory.css";

/** DESIGN.md §2: density is an attribute on `<html>`, so a story cannot opt
 *  into it and a decorator has to write the root attribute the app writes. */
const withDensity: Decorator = (Story, context) => {
  const density = context.globals.density as string;
  useEffect(() => {
    const root = document.documentElement;
    const previous = root.dataset.density;
    root.dataset.density = density;
    return () => {
      if (previous == null) delete root.dataset.density;
      else root.dataset.density = previous;
    };
  }, [density]);
  return <Story />;
};

const preview: Preview = {
  decorators: [withDensity],
  initialGlobals: { density: "comfortable" },
  globalTypes: {
    density: {
      description: "Row density, written to data-density on <html>",
      toolbar: {
        title: "Density",
        icon: "component",
        items: [
          { value: "comfortable", title: "Comfortable" },
          { value: "compact", title: "Compact" },
        ],
        dynamicTitle: true,
      },
    },
  },
  parameters: {
    a11y: {
      test: "error",
      options: {
        rules: {
          // Off in axe by default; component-checklist.md §4 requires it.
          "target-size": { enabled: true },
        },
      },
      // Per-rule thresholds are check options, which axe takes through
      // configure() rather than through run().
      config: {
        checks: [
          {
            // component-checklist.md §2. These are axe's own defaults; naming
            // them keeps the floor in the repo rather than in a dependency.
            id: "color-contrast",
            options: { contrastRatio: { normal: { expected: 4.5 }, large: { expected: 3 } } },
          },
          {
            // §4's absolute floor. axe holds one size, so the 44px primary
            // floor is not expressible here: tap-targets.spec.ts grades primary
            // against secondary by clearance and owns that half.
            id: "target-size",
            options: { minSize: 24 },
          },
          {
            // §4's clearance: a secondary control may be small if it is spaced.
            id: "target-offset",
            options: { minOffset: 8 },
          },
        ],
      },
    },
  },
};

export default preview;
