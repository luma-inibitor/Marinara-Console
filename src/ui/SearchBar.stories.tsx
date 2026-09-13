import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, within } from "storybook/test";
import { SearchBar } from "./SearchBar";

const NOTES = ["Harbour fog", "Harbour master", "Lighthouse keeper", "Fog bell"];

function SearchDemo(props: { initial?: string; counted?: boolean }) {
  const [q, setQ] = useState(props.initial ?? "");
  const matches = NOTES.filter((n) => n.toLowerCase().includes(q.trim().toLowerCase()));
  return (
    <SearchBar label="Search memories" value={q} onInput={setQ} count={props.counted ? matches.length : undefined} />
  );
}

const meta = {
  title: "UI/SearchBar",
  component: SearchDemo,
  parameters: { layout: "centered" },
  decorators: [(Story) => <div style={{ width: 320 }}>{Story()}</div>],
  args: { counted: true },
} satisfies Meta<typeof SearchDemo>;

export default meta;
type Story = StoryObj<typeof meta>;

// No query, so no tally.
export const Empty: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole("searchbox", { name: "Search memories" })).toHaveValue("");
    await expect(canvas.queryByText(/match/)).toBeNull();
  },
};

export const WithQuery: Story = {
  args: { initial: "fog" },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText("2 matches")).toBeVisible();
  },
};

export const Uncounted: Story = {
  args: { initial: "fog", counted: false },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).queryByText(/match/)).toBeNull();
  },
};

export const Typing: Story = {
  play: async ({ canvasElement, step }) => {
    const canvas = within(canvasElement);
    const input = canvas.getByRole("searchbox", { name: "Search memories" });

    await step("typing · the tally follows the query", async () => {
      await userEvent.type(input, "harbour");
      await expect(canvas.getByText("2 matches")).toBeVisible();
      await userEvent.type(input, " master");
      await expect(canvas.getByText("1 match")).toBeVisible();
    });

    await step("clearing · the tally goes with the query", async () => {
      await userEvent.clear(input);
      await expect(input).toHaveValue("");
      await expect(canvas.queryByText(/match/)).toBeNull();
    });
  },
};
