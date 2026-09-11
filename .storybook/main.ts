import type { StorybookConfig } from "@storybook/react-vite";

const config: StorybookConfig = {
  stories: ["../src/**/*.stories.tsx"],
  addons: ["@storybook/addon-a11y", "@storybook/addon-vitest"],
  framework: { name: "@storybook/react-vite", options: {} },
  core: { disableTelemetry: true },
  typescript: {
    // react-docgen-typescript reads the compiler API as `import * as ts from
    // "typescript"`, and typescript@7 exports only `version` from the package
    // root, so every call into it gets undefined. eslint.config.js records the
    // same gotcha for typescript-eslint.
    reactDocgen: "react-docgen",
  },
};

export default config;
