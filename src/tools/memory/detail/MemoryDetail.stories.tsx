import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, within } from "storybook/test";
import { Sheet } from "../../../ui";
import { notesById } from "../store/notes";
import { MemoryDetail } from "./MemoryDetail";
import { BARE, BY_TYPE, CORPUS } from "./fixtures";

notesById.set(new Map(CORPUS.map((n) => [n.id, n])));

const meta = {
  title: "Memory/MemoryDetail",
  component: MemoryDetail,
  parameters: { layout: "fullscreen" },
  decorators: [(Story) => <div style={{ height: "100vh" }}>{Story()}</div>],
  args: { onBack: () => {}, onEdit: () => {} },
} satisfies Meta<typeof MemoryDetail>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Source: Story = {
  args: { note: BY_TYPE.source },
  play: async ({ canvasElement, step }) => {
    const canvas = within(canvasElement);
    await step("a source folds its one long section and names where it came from", async () => {
      await expect(canvas.getByRole("button", { name: /§source/ })).toHaveAttribute("aria-expanded", "false");
      await expect(canvas.getByRole("region", { name: "Provenance" })).toBeVisible();
      await expect(canvas.getByRole("heading", { name: "Extraction fingerprint" })).toBeVisible();
    });
    await step("the section opens in place", async () => {
      await userEvent.click(canvas.getByRole("button", { name: /§source/ }));
      await expect(canvas.getByRole("button", { name: /§source/ })).toHaveAttribute("aria-expanded", "true");
    });
  },
};

export const TimelineEvent: Story = { args: { note: BY_TYPE.timeline_event } };

export const Character: Story = {
  args: { note: BY_TYPE.character },
  play: async ({ canvasElement, step }) => {
    const canvas = within(canvasElement);
    await step("headings run title, blocks, sections, sub-blocks", async () => {
      const levels = canvas.getAllByRole("heading").map((h) => Number(h.tagName.slice(1)));
      await expect(levels[0]).toBe(1);
      for (let i = 1; i < levels.length; i++) await expect(levels[i] - levels[i - 1]).toBeLessThanOrEqual(1);
    });
    await step("the keyword rail unfolds on tap", async () => {
      const rail = canvas.getByRole("button", { name: "Keywords, tap to unfold" });
      await expect(rail).toHaveAttribute("aria-expanded", "false");
      await userEvent.click(rail);
      await expect(rail).toHaveAttribute("aria-expanded", "true");
    });
    await step("one subject, five sections", async () => {
      await expect(canvas.getByRole("region", { name: "Subjects" })).toBeVisible();
      await expect(canvasElement.querySelectorAll("[data-section]")).toHaveLength(5);
    });
  },
};

export const Relationship: Story = {
  args: { note: BY_TYPE.relationship },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole("heading", { name: "Dimensions" })).toBeVisible();
    await expect(canvas.getByText("+5")).toBeVisible();
    await expect(canvas.getByText("-10")).toBeVisible();
  },
};

export const Scene: Story = { args: { note: BY_TYPE.scene } };

export const Thread: Story = { args: { note: BY_TYPE.thread } };

export const World: Story = { args: { note: BY_TYPE.world } };

export const Tone: Story = { args: { note: BY_TYPE.tone } };

export const Bare: Story = {
  args: { note: BARE, onEdit: undefined },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole("heading", { level: 1 })).toHaveTextContent(BARE.id);
    await expect(canvas.getByText("Available everywhere")).toBeVisible();
    await expect(canvas.queryByRole("button", { name: "Keywords, tap to unfold" })).toBeNull();
    await expect(canvas.queryByText("links")).toBeNull();
  },
};

export const Raised: Story = { args: { note: BY_TYPE.world, ground: "raised" } };

export const Peek: Story = {
  args: { note: BY_TYPE.thread, peek: true, onEdit: undefined, ground: "raised" },
  render: (args) => (
    <Sheet className="peek-sheet" label={args.note.title ?? args.note.id} onClose={args.onBack}>
      <MemoryDetail {...args} />
    </Sheet>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole("button", { name: "Close" })).toHaveFocus();
    await expect(canvas.getByText("Raw memory")).toBeVisible();
  },
};

export const Dense: Story = { args: { note: BY_TYPE.character }, globals: { density: "compact" } };
