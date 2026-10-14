import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, within } from "storybook/test";
import { SegmentedControl } from "./SegmentedControl";

function Demo() {
  const [value, setValue] = useState("off");
  return (
    <div className="p-3">
      <SegmentedControl
        label="Decision"
        value={value}
        onChange={setValue}
        segments={[
          { id: "off", label: "Off" },
          { id: "require", label: "Require" },
          { id: "trigger", label: "Trigger", disabledReason: "A Constant entry already activates every turn." },
        ]}
      />
    </div>
  );
}

const meta = { title: "UI/SegmentedControl", component: Demo } satisfies Meta<typeof Demo>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvasElement, step }) => {
    const canvas = within(canvasElement);
    await step("one segment is pressed", async () => {
      await expect(canvas.getByRole("button", { name: "Off" })).toHaveAttribute("aria-pressed", "true");
    });
    await step("a press moves the choice", async () => {
      await userEvent.click(canvas.getByRole("button", { name: "Require" }));
      await expect(canvas.getByRole("button", { name: "Require" })).toHaveAttribute("aria-pressed", "true");
      await expect(canvas.getByRole("button", { name: "Off" })).toHaveAttribute("aria-pressed", "false");
    });
  },
};
