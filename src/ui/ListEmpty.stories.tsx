import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, within } from "storybook/test";
import { ListEmpty } from "./ListEmpty";

const meta = {
  title: "UI/ListEmpty",
  component: ListEmpty,
  parameters: { layout: "centered" },
  decorators: [(Story) => <div style={{ width: 420 }}>{Story()}</div>],
  args: { kind: "first-run", what: "shell.tool.presets" },
} satisfies Meta<typeof ListEmpty>;

export default meta;
type Story = StoryObj<typeof meta>;

export const FirstRun: Story = {
  args: { action: { label: "Add preset", run: fn() } },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: /add preset/i }));
    await expect(args.action?.run).toHaveBeenCalledOnce();
  },
};

export const FirstRunNoAction: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.queryByRole("button")).toBeNull();
  },
};

export const Filtered: Story = {
  args: {
    kind: "filtered",
    filters: [
      { label: "scope: this chat", clear: fn() },
      { label: "kind: fact", clear: fn() },
    ],
    onClearAll: fn(),
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: /clear filters/i }));
    await expect(args.onClearAll).toHaveBeenCalledOnce();
  },
};

export const Cleared: Story = { args: { kind: "cleared" } };
