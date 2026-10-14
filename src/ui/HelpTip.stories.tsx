import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, within } from "storybook/test";
import { HelpTip } from "./HelpTip";

const meta = {
  title: "UI/HelpTip",
  component: HelpTip,
  args: {
    tip: "When any of these words come up in the chat, the AI gets this entry's content.",
    subject: "Primary Keys",
  },
  decorators: [
    (Story) => (
      <div className="flex w-[480px] items-center gap-2 p-3 pb-24">
        <span className="t-label t-label-s text-dim">Primary Keys</span>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof HelpTip>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvasElement, step }) => {
    const button = within(canvasElement).getByRole("button", { name: /Primary Keys/ });
    await step("a tap opens the tip and Escape closes it", async () => {
      await userEvent.click(button);
      await expect(button).toHaveAttribute("aria-expanded", "true");
      await expect(within(canvasElement).getByRole("tooltip")).toBeVisible();
      await userEvent.keyboard("{Escape}");
      await expect(button).toHaveAttribute("aria-expanded", "false");
    });
  },
};

export const AlignedEnd: Story = { args: { align: "end" } };
