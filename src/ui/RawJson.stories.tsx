import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, within } from "storybook/test";
import { RawJson } from "./RawJson";

const NOTE = {
  id: "source_lorebook_d81a750ad0c1a6d7",
  type: "world",
  title: "Harbour fog",
  status: "active",
  sections: [{ key: "summary", text: "Fog rolls in from the harbour every dusk." }],
};

const LINES = JSON.stringify(NOTE, null, 2).split("\n").length;

const meta = {
  title: "UI/RawJson",
  component: RawJson,
  parameters: { layout: "padded" },
  decorators: [(Story) => <div style={{ width: 360 }}>{Story()}</div>],
  args: { value: NOTE },
} satisfies Meta<typeof RawJson>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Closed: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("Raw record")).toBeVisible();
    await expect(canvas.getByText(`${LINES} lines`)).toBeVisible();
    await expect(canvas.getByRole("group", { name: "Raw record" })).not.toBeVisible();
  },
};

export const Open: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByText("Raw record"));
    await expect(canvas.getByRole("group", { name: "Raw record" })).toBeVisible();
    await expect(canvas.getAllByRole("button", { name: "Collapse root (5)" })[0]).toBeVisible();
  },
};

export const Labelled: Story = {
  args: { label: "Raw memory" },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByText("Raw memory"));
    await expect(canvas.getByRole("group", { name: "Raw memory" })).toBeVisible();
  },
};

export const OneLine: Story = {
  args: { value: "active" },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText("1 line")).toBeVisible();
  },
};

export const Empty: Story = { args: { value: {} } };
