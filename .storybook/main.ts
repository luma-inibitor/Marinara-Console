import type { StorybookConfig } from "@storybook/react-vite";

const config: StorybookConfig = {
  stories: ["../src/**/*.stories.tsx"],
  addons: ["@storybook/addon-a11y", "@storybook/addon-vitest"],
  framework: { name: "@storybook/react-vite", options: {} },
  core: { disableTelemetry: true },
  typescript: {
    // react-docgen-typescript imports the typescript package root, which typescript@7 leaves empty.
    reactDocgen: "react-docgen",
  },
};

export default config;
