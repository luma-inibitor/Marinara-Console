import type { StorybookConfig } from "@storybook/react-vite";

// Storybook is the harness the shared components are authored against. The
// Playwright specs under tests/e2e/ iterate eight screens, so a component that
// no screen mounts is checked by nothing; a story puts it in front of axe.
//
// Stories sit beside the component they cover, like the Vitest files do
// (ARCHITECTURE.md §2). A `.stories.tsx` under src/ui/ is presentation to
// layercheck, which is what it is.
const config: StorybookConfig = {
  stories: ["../src/**/*.stories.tsx"],
  addons: ["@storybook/addon-a11y", "@storybook/addon-vitest"],
  framework: { name: "@storybook/react-vite", options: {} },
  // CI runs this on every pull request, and a build step that makes a network
  // call it does not need is a build step that can fail for a reason unrelated
  // to the change.
  core: { disableTelemetry: true },
  typescript: {
    // The default react-docgen, NOT react-docgen-typescript. That plugin reads
    // the compiler API as `import * as ts from "typescript"`, and typescript@7
    // exports only `version` from the package root, so every call into it gets
    // undefined. eslint.config.js records the same gotcha for typescript-eslint.
    reactDocgen: "react-docgen",
  },
};

export default config;
