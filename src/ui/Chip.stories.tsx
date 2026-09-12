import type { Meta, StoryObj } from "@storybook/react-vite";
import { Chip } from "./Chip";

const meta = {
  title: "UI/Chip",
  component: Chip,
  parameters: { layout: "centered" },
  args: { children: "roleplay" },
} satisfies Meta<typeof Chip>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Action: Story = {};

export const Pressed: Story = { args: { pressed: true } };

export const Unpressed: Story = { args: { pressed: false } };

export const Flag: Story = { args: { flag: true, pressed: true, children: "outliers" } };

export const Disabled: Story = { args: { disabled: true } };
