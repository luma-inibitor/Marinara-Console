import type { Meta, StoryObj } from "@storybook/react-vite";
import { Chip } from "./Chip";

// A small presentational control on a stylesheet rather than on utilities.
// It is here to prove the harness reads a component's own CSS as well as it
// reads Tailwind, and to put a 24px-class control in front of the target-size
// rule the preview enables.
const meta = {
  title: "UI/Chip",
  component: Chip,
  parameters: { layout: "centered" },
  args: { children: "roleplay" },
} satisfies Meta<typeof Chip>;

export default meta;
type Story = StoryObj<typeof meta>;

/** An action: no `pressed`, so it reports no toggle state. */
export const Action: Story = {};

/** Passing `pressed` makes it a toggle. This is the on half. */
export const Pressed: Story = { args: { pressed: true } };

/** And the off half, which still announces itself as a toggle. */
export const Unpressed: Story = { args: { pressed: false } };

/** The flag hue, reserved for filters over computed outliers. Hue is the only
 *  thing that changes, so a story is where the checklist's "colour alone isn't
 *  enough" line gets looked at. */
export const Flag: Story = { args: { flag: true, pressed: true, children: "outliers" } };

export const Disabled: Story = { args: { disabled: true } };
