import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, within } from "storybook/test";
import { Chip } from "./Chip";
import { DetailSection } from "./DetailSection";
import { Meter } from "./Meter";

const meta = {
  title: "UI/DetailSection",
  component: DetailSection,
  parameters: { layout: "centered" },
  decorators: [(Story) => <div style={{ width: 360 }}>{Story()}</div>],
  args: {
    sectionKey: "core",
    children: <p className="m-0 font-prose text-prose">Keeps a harbour log, and reads it aloud on foggy nights.</p>,
  },
} satisfies Meta<typeof DetailSection>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const heading = within(canvasElement).getByRole("heading", { level: 4 });
    await expect(heading).toHaveTextContent("core");
  },
};

export const WithMeta: Story = {
  args: {
    meta: (
      <>
        <span className="t-data text-data-s text-dim">1,024 / 4,000</span>
        <Chip>Dedupe lines</Chip>
      </>
    ),
  },
};

export const WithMeter: Story = {
  args: {
    meta: <span className="t-data text-data-s text-dim">3,100 / 4,000</span>,
    meter: <Meter label="78% of cap" max={4000} value={3100} near={0.75} over={0.95} className="mt-1" />,
  },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole("meter", { name: "78% of cap" })).toBeVisible();
  },
};
