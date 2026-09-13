import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, within } from "storybook/test";
import { Term } from "./Term";
import { Edit, ICON_SIZE } from "./icons";

const meta = {
  title: "UI/Term",
  component: Term,
  parameters: { layout: "centered" },
  decorators: [(Story) => <div style={{ paddingBottom: 80 }}>{Story()}</div>],
  args: { tip: "claim kind · static — a fact that does not change", children: "static" },
} satisfies Meta<typeof Term>;

export default meta;
type Story = StoryObj<typeof meta>;

const term = (root: HTMLElement) => within(root).getByText("static");

export const Word: Story = {
  play: async ({ canvasElement }) => {
    await expect(term(canvasElement)).toHaveAttribute("tabindex", "0");
    await expect(term(canvasElement)).not.toHaveAttribute("data-open");
  },
};

export const Chip: Story = { args: { chip: true } };

export const Icon: Story = {
  args: {
    tip: "edited · this section was changed after extraction",
    children: <Edit size={ICON_SIZE.sm} aria-label="edited" />,
  },
};

export const Open: Story = {
  play: async ({ canvasElement }) => {
    await userEvent.click(term(canvasElement));
    await expect(term(canvasElement)).toHaveAttribute("data-open", "true");
    await userEvent.keyboard("{Escape}");
    await expect(term(canvasElement)).not.toHaveAttribute("data-open");
  },
};

export const OutOfTabOrder: Story = {
  args: { tabIndex: -1 },
  play: async ({ canvasElement }) => {
    await expect(term(canvasElement)).toHaveAttribute("tabindex", "-1");
  },
};
