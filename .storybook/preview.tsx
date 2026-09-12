import { useEffect } from "react";
import type { Decorator, Preview } from "@storybook/react-vite";

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
          "target-size": { enabled: true },
        },
      },
      config: {
        checks: [
          {
            // Restates axe's defaults so the floor is in the repo.
            id: "color-contrast",
            options: { contrastRatio: { normal: { expected: 4.5 }, large: { expected: 3 } } },
          },
          {
            // The 44px primary floor is checked in tests/e2e/tap-targets.spec.ts.
            id: "target-size",
            options: { minSize: 24 },
          },
          {
            id: "target-offset",
            options: { minOffset: 8 },
          },
        ],
      },
    },
  },
};

export default preview;
