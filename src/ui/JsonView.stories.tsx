import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, waitFor, within } from "storybook/test";
import { JsonView } from "./JsonView";

const NOTE = {
  id: "source_lorebook_d81a750ad0c1a6d7",
  type: "world",
  title: "Harbour fog",
  archived: false,
  weight: 0.42,
  parent: null,
  sections: [
    { key: "summary", text: "Fog rolls in from the harbour every dusk, and the bells ring until it lifts." },
    { key: "keywords", text: "fog, harbour, bells" },
  ],
  links: { characters: ["Harbourmaster Vell"], threads: [] },
};

const meta = {
  title: "UI/JsonView",
  component: JsonView,
  parameters: { layout: "padded" },
  decorators: [(Story) => <div style={{ width: 360 }}>{Story()}</div>],
  args: { value: NOTE, label: "Raw memory" },
} satisfies Meta<typeof JsonView>;

export default meta;
type Story = StoryObj<typeof meta>;

// Open to depth 1: the top level is readable, anything deeper is folded.
export const Nested: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole("group", { name: "Raw memory" })).toBeVisible();
    await expect(canvas.getByRole("button", { name: "Folding view" })).toHaveAttribute("aria-pressed", "true");
    await expect(canvas.getAllByRole("button", { name: "Collapse root (8)" })[0]).toHaveAttribute(
      "aria-expanded",
      "true",
    );
    await expect(canvas.getByRole("button", { name: "Expand sections (2)" })).toHaveAttribute("aria-expanded", "false");
  },
};

export const Fold: Story = {
  play: async ({ canvasElement, step }) => {
    const canvas = within(canvasElement);
    await step("expand a folded node", async () => {
      await userEvent.click(canvas.getByRole("button", { name: "Expand sections (2)" }));
      await expect(canvas.getAllByRole("button", { name: "Collapse sections (2)" })[0]).toHaveAttribute(
        "aria-expanded",
        "true",
      );
      await userEvent.click(canvas.getAllByRole("button", { name: "Expand root (2)" })[0]);
      await expect(canvas.getByText(/Fog rolls in from the harbour every dusk/)).toBeVisible();
    });
    await step("the closing brace collapses it too", async () => {
      const closers = canvas.getAllByRole("button", { name: "Collapse sections (2)" });
      await userEvent.click(closers[closers.length - 1]);
      await expect(canvas.getByRole("button", { name: "Expand sections (2)" })).toHaveTextContent("2");
    });
  },
};

export const Plain: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: "Plain text" }));
    await expect(canvas.getByRole("button", { name: "Plain text" })).toHaveAttribute("aria-pressed", "true");
    await expect(canvas.getByRole("button", { name: "Folding view" })).toHaveAttribute("aria-pressed", "false");
    await expect(canvasElement.querySelector("pre")).toHaveTextContent('"title": "Harbour fog"');
  },
};

// The test browser refuses clipboard writes, so the story supplies the clipboard.
export const CopySuccess: Story = {
  play: async ({ canvasElement }) => {
    const writeText = fn(async () => {});
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: "Copy JSON" }));
    await waitFor(() => expect(canvas.getByRole("status")).toHaveTextContent("Copied"));
    await expect(writeText).toHaveBeenCalledWith(JSON.stringify(NOTE, null, 2));
  },
};

export const EmptyObject: Story = {
  args: { value: {} },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getAllByRole("button", { name: "Collapse root (0)" })[0]).toBeVisible();
  },
};

export const EmptyArray: Story = { args: { value: [] } };

export const Primitive: Story = {
  args: { value: "active" },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText('"active"')).toBeVisible();
  },
};

export const Unlabelled: Story = {
  args: { label: undefined },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole("group", { name: "JSON view" })).toBeVisible();
  },
};
