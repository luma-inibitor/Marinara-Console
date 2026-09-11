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

/** No `pressed`, so it reports no toggle state. */
export const Action: Story = {};

export const Pressed: Story = { args: { pressed: true } };

export const Unpressed: Story = { args: { pressed: false } };

/** The flag hue, reserved for filters over computed outliers. Hue is the only
 *  thing that changes, so this is where the checklist's "colour alone isn't
 *  enough" line gets looked at. */
export const Flag: Story = { args: { flag: true, pressed: true, children: "outliers" } };

export const Disabled: Story = { args: { disabled: true } };
