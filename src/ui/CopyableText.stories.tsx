import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, waitFor, within } from "storybook/test";
import { CopyableText } from "./CopyableText";

const meta = {
  title: "UI/CopyableText",
  component: CopyableText,
  parameters: { layout: "centered" },
  decorators: [(Story) => <div style={{ width: 240 }}>{Story()}</div>],
  args: { value: "source_lorebook_d81a750ad0c1a6d7" },
} satisfies Meta<typeof CopyableText>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole("button", { name: "Copy source_lorebook_d81a750ad0c1a6d7" })).toBeVisible();
    await expect(canvas.getByRole("status")).toBeEmptyDOMElement();
  },
};

export const Labelled: Story = {
  args: { label: "memory id" },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole("button", { name: "Copy memory id" })).toBeVisible();
  },
};

export const Long: Story = {
  args: {
    value:
      "/Users/luma/Library/Application Support/Marinara/long-term-memory/notes/source_lorebook_d81a750ad0c1a6d7.json",
  },
};

// The test browser refuses clipboard writes, so the story supplies the clipboard.
export const CopySuccess: Story = {
  args: { label: "memory id" },
  play: async ({ canvasElement }) => {
    const writeText = fn(async () => {});
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: "Copy memory id" }));
    await waitFor(() => expect(canvas.getByRole("status")).toHaveTextContent("Copied"));
    await expect(writeText).toHaveBeenCalledWith("source_lorebook_d81a750ad0c1a6d7");
  },
};
