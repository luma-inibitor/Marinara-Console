import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, within } from "storybook/test";
import { Accordion } from "./Accordion";

function Demo(props: { unavailable?: boolean; error?: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="w-[480px] bg-surface-2">
      <Accordion
        label="Timing"
        summary="Sticky 2 · Cooldown 3"
        tip="Counted in generations, per chat."
        open={open}
        onToggle={() => setOpen(!open)}
        unavailable={props.unavailable}
        error={props.error}
      >
        <p className="font-prose text-prose text-ink">Section body.</p>
      </Accordion>
    </div>
  );
}

const meta = {
  title: "UI/Accordion",
  component: Demo,
} satisfies Meta<typeof Demo>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvasElement, step }) => {
    const header = within(canvasElement).getByRole("button", { name: /^Timing/ });
    await step("the closed header carries its value", async () => {
      await expect(header).toHaveAttribute("aria-expanded", "false");
      await expect(header).toHaveAccessibleName("Timing Sticky 2 · Cooldown 3");
    });
    await step("Enter opens it", async () => {
      header.focus();
      await userEvent.keyboard("{Enter}");
      await expect(header).toHaveAttribute("aria-expanded", "true");
      await expect(within(canvasElement).getByText("Section body.")).toBeVisible();
    });
  },
};

export const Unavailable: Story = {
  args: { unavailable: true },
  play: async ({ canvasElement }) => {
    const header = within(canvasElement).getByRole("button", { name: /^Timing/ });
    await userEvent.click(header);
    await expect(header).toHaveAttribute("aria-disabled", "true");
    await expect(header).toHaveAttribute("aria-expanded", "false");
  },
};

export const WithError: Story = { args: { error: true } };
