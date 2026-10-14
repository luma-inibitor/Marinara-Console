import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, within } from "storybook/test";
import { Switch } from "./Switch";

function Demo() {
  const [on, setOn] = useState(true);
  return (
    <div className="p-3">
      <Switch checked={on} onChange={setOn} label="Enabled" />
    </div>
  );
}

const meta = { title: "UI/Switch", component: Demo } satisfies Meta<typeof Demo>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const sw = within(canvasElement).getByRole("switch", { name: "Enabled" });
    await expect(sw).toHaveAttribute("aria-checked", "true");
    await userEvent.click(sw);
    await expect(sw).toHaveAttribute("aria-checked", "false");
  },
};
