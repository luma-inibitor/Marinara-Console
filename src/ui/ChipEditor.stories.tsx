import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, within } from "storybook/test";
import { ChipEditor } from "./ChipEditor";

function Demo() {
  const [values, setValues] = useState(["fog", "mist"]);
  return (
    <div className="w-[420px] p-3">
      <ChipEditor values={values} onChange={setValues} label="Primary Keys" placeholder="+ key" highlight={["fog"]} />
    </div>
  );
}

const meta = { title: "UI/ChipEditor", component: Demo } satisfies Meta<typeof Demo>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvasElement, step }) => {
    const canvas = within(canvasElement);
    await step("a pasted list splits on commas", async () => {
      await userEvent.type(canvas.getByRole("textbox", { name: "Primary Keys" }), "bell, tide{Enter}");
      await expect(canvas.getByText("bell")).toBeVisible();
      await expect(canvas.getByText("tide")).toBeVisible();
    });
    await step("a chip's button removes it", async () => {
      await userEvent.click(canvas.getByRole("button", { name: /mist/ }));
      await expect(canvas.queryByText("mist")).toBeNull();
    });
  },
};
