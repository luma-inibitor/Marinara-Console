import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, within } from "storybook/test";
import { Edu } from "./Edu";

const meta = {
  title: "UI/Edu",
  component: Edu,
  parameters: { layout: "centered" },
  decorators: [(Story) => <div style={{ width: 320 }}>{Story()}</div>],
  args: { children: "Related memories are found by keyword overlap." },
} satisfies Meta<typeof Edu>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("Related memories are found by keyword overlap.")).toBeVisible();
    await expect(canvasElement.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
  },
};

// The icon stays on the first line while the text wraps.
export const Wrapping: Story = {
  args: {
    children:
      "The extraction text is what the model reads when it builds memories from this source. Trim it to the passages that matter, and leave out the ones that only restate the character card.",
  },
};
