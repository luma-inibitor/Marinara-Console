import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, within } from "storybook/test";
import { Meter } from "./Meter";

const meta = {
  title: "UI/Meter",
  component: Meter,
  parameters: { layout: "centered" },
  decorators: [(Story) => <div style={{ width: 240 }}>{Story()}</div>],
  args: { label: "cap", max: 100, near: 0.8, over: 1 },
} satisfies Meta<typeof Meter>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Empty: Story = { args: { value: 0 } };

export const Partial: Story = {
  args: { value: 40 },
  play: async ({ canvasElement }) => {
    const meter = within(canvasElement).getByRole("meter", { name: "cap" });
    await expect(meter).toHaveAttribute("aria-valuenow", "40");
    await expect(meter).toHaveAttribute("aria-valuemin", "0");
    await expect(meter).toHaveAttribute("aria-valuemax", "100");
  },
};

export const Near: Story = { args: { value: 85 } };

// The fill stops at the track's end and the value reads as the maximum.
export const Over: Story = {
  args: { value: 130 },
  play: async ({ canvasElement }) => {
    const meter = within(canvasElement).getByRole("meter", { name: "cap" });
    await expect(meter).toHaveAttribute("aria-valuenow", "100");
  },
};

// Without a label the meter is hidden from assistive technology.
export const Decorative: Story = {
  args: { label: undefined, value: 40 },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).queryByRole("meter")).toBeNull();
    await expect(canvasElement.querySelector("[aria-hidden='true']")).not.toBeNull();
  },
};

export const Medium: Story = { args: { value: 40, size: "md" } };

export const Segmented: Story = {
  args: {
    label: "12 of 20 decided",
    max: 20,
    segments: [
      { value: 8, tone: "ok" },
      { value: 4, tone: "danger" },
    ],
  },
  play: async ({ canvasElement }) => {
    const meter = within(canvasElement).getByRole("meter", { name: "12 of 20 decided" });
    await expect(meter).toHaveAttribute("aria-valuenow", "12");
    await expect(meter).toHaveAttribute("aria-valuemax", "20");
  },
};
