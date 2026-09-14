import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, within } from "storybook/test";
import { NotFound } from "./NotFound";

const meta = {
  title: "UI/NotFound",
  component: NotFound,
  parameters: { layout: "centered" },
  decorators: [(Story) => <div style={{ width: 420 }}>{Story()}</div>],
  args: { what: "lorebooks.book" },
} satisfies Meta<typeof NotFound>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole("button", { name: /back to lorebooks/i })).toBeVisible();
  },
};

export const WithId: Story = { args: { id: "lb_7f3a" } };

export const CustomBack: Story = {
  args: { what: "presets.preset", backTo: "presets", backLabel: "Back to presets" },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole("button", { name: /back to presets/i })).toBeVisible();
  },
};
