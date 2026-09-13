import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, within } from "storybook/test";
import { ModePill } from "./ModePill";

function TogglePill(props: { modes: string[]; label?: string }) {
  const [modes, setModes] = useState(new Set(props.modes));
  return (
    <ModePill
      modes={modes}
      label={props.label}
      onToggle={(id) => {
        const next = new Set(modes);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        setModes(next);
      }}
    />
  );
}

const meta = {
  title: "UI/ModePill",
  component: ModePill,
  parameters: { layout: "centered" },
  args: { modes: ["conversation", "game"] },
} satisfies Meta<typeof ModePill>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Readout: Story = {
  play: async ({ canvasElement }) => {
    const pill = within(canvasElement).getByRole("img");
    await expect(pill).toHaveAccessibleName(/Conversation.*Game/);
    await expect(within(canvasElement).queryByRole("button")).toBeNull();
  },
};

export const ReadoutNone: Story = { args: { modes: [] } };

export const ReadoutAll: Story = { args: { modes: ["conversation", "roleplay", "game"] } };

export const Toggle: Story = {
  render: (args) => <TogglePill modes={args.modes as string[]} label={args.label} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole("group")).toBeVisible();
    const dm = canvas.getByRole("button", { name: /DM/ });
    const rp = canvas.getByRole("button", { name: /RP/ });
    await expect(dm).toHaveAttribute("aria-pressed", "true");
    await expect(rp).toHaveAttribute("aria-pressed", "false");
    await userEvent.click(dm);
    await expect(dm).toHaveAttribute("aria-pressed", "false");
    await userEvent.click(rp);
    await expect(rp).toHaveAttribute("aria-pressed", "true");
  },
};

export const ToggleAll: Story = {
  args: { modes: ["conversation", "roleplay", "game"] },
  render: (args) => <TogglePill modes={args.modes as string[]} />,
};

export const ToggleLabelled: Story = {
  args: { label: "Modes to import" },
  render: (args) => <TogglePill modes={args.modes as string[]} label={args.label} />,
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole("group", { name: "Modes to import" })).toBeVisible();
  },
};
