import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, within } from "storybook/test";
import { Chip, Tag } from "./Chip";

const meta = {
  title: "UI/Chip",
  component: Chip,
  parameters: { layout: "centered" },
  args: { children: "roleplay", onClick: fn() },
} satisfies Meta<typeof Chip>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Action: Story = {
  play: async ({ canvasElement, args }) => {
    const chip = within(canvasElement).getByRole("button", { name: "roleplay" });
    await expect(chip).not.toHaveAttribute("aria-pressed");
    await userEvent.click(chip);
    await expect(args.onClick).toHaveBeenCalledTimes(1);
  },
};

export const Pressed: Story = {
  args: { pressed: true },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole("button", { name: "roleplay" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  },
};

export const Unpressed: Story = {
  args: { pressed: false },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole("button", { name: "roleplay" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  },
};

export const Flag: Story = { args: { flag: true, pressed: true, children: "outliers" } };

export const Disabled: Story = {
  args: { disabled: true },
  play: async ({ canvasElement, args }) => {
    const chip = within(canvasElement).getByRole("button", { name: "roleplay" });
    await expect(chip).toBeDisabled();
    await userEvent.click(chip);
    await expect(args.onClick).not.toHaveBeenCalled();
  },
};

export const WithCount: Story = {
  args: {
    pressed: true,
    children: (
      <>
        Facets <b className="ar">3</b>
      </>
    ),
  },
};

export const Static: Story = {
  render: () => <Tag>keyword</Tag>,
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).queryByRole("button")).toBeNull();
    await expect(within(canvasElement).getByText("keyword")).toBeVisible();
  },
};
