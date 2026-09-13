import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, within } from "storybook/test";
import { SectionKey } from "./SectionKey";

const meta = {
  title: "UI/SectionKey",
  component: SectionKey,
  parameters: { layout: "centered" },
  args: { k: "core" },
} satisfies Meta<typeof SectionKey>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText("§core")).toBeVisible();
  },
};

export const LongKey: Story = { args: { k: "relationship_with_the_observatory" } };

export const InProse: Story = {
  render: (args) => (
    <p className="m-0 font-prose text-prose">
      Appends two lines to <SectionKey {...args} /> of Ada.
    </p>
  ),
};
