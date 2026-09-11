import { beforeAll } from "vitest";
import { setProjectAnnotations } from "@storybook/react-vite";
import preview from "./preview";

// Gives every story run by vitest.storybook.config.ts the decorators,
// parameters and globals the manager applies.
const project = setProjectAnnotations([preview]);

beforeAll(project.beforeAll);
