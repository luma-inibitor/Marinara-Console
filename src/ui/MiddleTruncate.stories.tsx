import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, within } from "storybook/test";
import { MiddleTruncate } from "./MiddleTruncate";

const BOOK = "Lorebook - Ashgate — Harbour Canon: ";

const meta = {
  title: "UI/MiddleTruncate",
  component: MiddleTruncate,
  parameters: { layout: "centered", width: 240 },
  decorators: [(Story, context) => <div style={{ width: context.parameters.width as number }}>{Story()}</div>],
  args: { text: `${BOOK}The Tidewatch Compact`, className: "t-prose" },
} satisfies Meta<typeof MiddleTruncate>;

export default meta;
type Story = StoryObj<typeof meta>;

// The head elides, the tail stays whole.
export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const title = canvas.getByTitle(`${BOOK}The Tidewatch Compact`);
    await expect(title).toHaveTextContent(`${BOOK}The Tidewatch Compact`);
    const tail = canvasElement.querySelector("bdi");
    await expect(tail).toHaveTextContent(/The Tidewatch Compact$/);
    await expect(tail?.parentElement).toHaveAttribute("aria-hidden", "true");
  },
};

// A title no longer than the tail has no middle to give up.
export const Short: Story = {
  args: { text: "Harbourmaster Vell" },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText("Harbourmaster Vell", { selector: "[aria-hidden]" })).toBeVisible();
  },
};

// Once the head is gone the tail sheds from its own start.
export const Narrow: Story = { parameters: { width: 120 } };

export const Wide: Story = { parameters: { width: 480 } };

export const Graphemes: Story = { args: { text: `${BOOK}The Guild of Cinders 👩‍👧‍👦 café` } };
