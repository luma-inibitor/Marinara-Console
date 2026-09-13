import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, within } from "storybook/test";
import { Progress } from "./Progress";

const meta = {
  title: "UI/Progress",
  component: Progress,
  parameters: { layout: "centered" },
  decorators: [(Story) => <div style={{ width: 240 }}>{Story()}</div>],
  args: { label: "importing", max: 10 },
} satisfies Meta<typeof Progress>;

export default meta;
type Story = StoryObj<typeof meta>;

const bar = (root: HTMLElement) => within(root).getByRole("progressbar", { name: "importing" });

export const Empty: Story = {
  args: { value: 0 },
  play: async ({ canvasElement }) => {
    await expect(bar(canvasElement)).toHaveAttribute("aria-valuenow", "0");
    await expect(bar(canvasElement)).toHaveAttribute("aria-valuemin", "0");
    await expect(bar(canvasElement)).toHaveAttribute("aria-valuemax", "10");
  },
};

export const Half: Story = {
  args: { value: 5 },
  play: async ({ canvasElement }) => {
    await expect(bar(canvasElement)).toHaveAttribute("aria-valuenow", "5");
  },
};

export const Complete: Story = {
  args: { value: 10 },
  play: async ({ canvasElement }) => {
    await expect(bar(canvasElement)).toHaveAttribute("aria-valuenow", "10");
  },
};

// The value stops at the maximum, so the numbers stay inside the range.
export const Over: Story = {
  args: { value: 14 },
  play: async ({ canvasElement }) => {
    await expect(bar(canvasElement)).toHaveAttribute("aria-valuenow", "10");
  },
};

export const Indeterminate: Story = {
  args: { value: undefined },
  play: async ({ canvasElement }) => {
    await expect(bar(canvasElement)).not.toHaveAttribute("aria-valuenow");
    await expect(bar(canvasElement)).toHaveAttribute("aria-valuemax", "10");
  },
};

export const WithText: Story = {
  args: { value: 5, text: "5 / 10" },
  play: async ({ canvasElement }) => {
    await expect(bar(canvasElement)).toHaveAttribute("aria-valuenow", "5");
    await expect(within(canvasElement).getByText("5 / 10")).toBeVisible();
  },
};

export const Inline: Story = {
  args: { value: 5, text: "5 / 10", inline: true },
};

export const Medium: Story = { args: { value: 5, size: "md" } };

// Without a label the bar is hidden from assistive technology.
export const Decorative: Story = {
  args: { label: undefined, value: 5 },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).queryByRole("progressbar")).toBeNull();
    await expect(canvasElement.querySelector("[aria-hidden='true']")).not.toBeNull();
  },
};
