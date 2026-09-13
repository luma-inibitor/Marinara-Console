import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, waitFor, within } from "storybook/test";
import { Button } from "./Button";
import { Confirm, Copy, ICON_SIZE, Remove } from "./icons";

const meta = {
  title: "UI/Button",
  component: Button,
  parameters: { layout: "centered" },
  args: { children: "Save changes" },
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

const REASON = "Nothing has changed since you opened this.";

export const Primary: Story = { args: { variant: "primary" } };
export const Secondary: Story = { args: { variant: "secondary" } };
export const Ghost: Story = { args: { variant: "ghost" } };

export const Danger: Story = { args: { variant: "primary", tone: "danger", children: "Delete source" } };
export const Ok: Story = { args: { variant: "primary", tone: "ok", children: "Accept" } };

export const Small: Story = { args: { size: "sm" } };
/** 24px, the secondary floor, for a control inside a data block. */
export const ExtraSmall: Story = {
  args: { size: "xs", iconOnly: true, variant: "ghost", label: "Copy value", icon: <Copy size={ICON_SIZE.sm} /> },
};
export const SentenceCase: Story = { args: { labelCase: "sentence" } };
/** A full-width row that reads from the left, indented by the caller, named apart from its visible text. */
export const Row: Story = {
  parameters: { layout: "padded" },
  args: {
    variant: "ghost",
    size: "xs",
    labelCase: "sentence",
    fullWidth: true,
    align: "start",
    label: "Expand root (3)",
    style: { paddingLeft: 12 },
    expanded: false,
    children: "root: {",
  },
};

export const Focus: Story = { args: { variant: "primary", autoFocus: true } };

export const Pressed: Story = { args: { variant: "secondary", pressed: true, children: "Filters" } };

export const DisabledWithReason: Story = {
  args: { disabled: true, disabledReason: REASON, onClick: fn() },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    const button = canvas.getByRole("button");
    await userEvent.tab();
    await expect(button).toHaveFocus();
    await expect(button).toHaveAccessibleDescription(REASON);
    await expect(canvas.getByRole("tooltip")).toBeVisible();
    await userEvent.click(button);
    await expect(args.onClick).not.toHaveBeenCalled();
  },
};

export const DisabledNative: Story = { args: { disabled: true } };

// The spinner appears after a second.
export const Pending: Story = {
  args: { variant: "primary", pending: true },
  play: async ({ canvasElement }) => {
    const button = within(canvasElement).getByRole("button");
    await expect(button).toHaveAttribute("aria-busy", "true");
    await waitFor(() => expect(button.querySelector("svg")).toBeInTheDocument(), { timeout: 3000 });
    await expect(button.querySelector("svg")).not.toHaveAttribute("aria-label");
  },
};

export const WithIcon: Story = {
  args: { variant: "primary", icon: <Confirm size={ICON_SIZE.md} />, children: "Accept" },
};

export const IconOnly: Story = {
  args: { iconOnly: true, label: "Delete source", icon: <Remove size={ICON_SIZE.md} />, tone: "danger" },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole("button")).toHaveAccessibleName("Delete source");
  },
};

export const FullWidth: Story = {
  args: { variant: "primary", fullWidth: true },
  parameters: { layout: "padded" },
};

export const AsLink: Story = { args: { href: "#backup", download: true, children: "Download backup" } };

export const DisabledLinkWithReason: Story = {
  args: { href: "#backup", disabled: true, disabledReason: REASON, children: "Download backup", onClick: fn() },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    const link = canvas.getByRole("link");
    const hash = window.location.hash;
    await userEvent.tab();
    await expect(link).toHaveFocus();
    await expect(link).toHaveAttribute("aria-disabled", "true");
    await expect(link).toHaveAccessibleDescription(REASON);
    await expect(canvas.getByRole("tooltip")).toBeVisible();
    await userEvent.keyboard("{Enter}");
    await userEvent.click(link);
    await expect(args.onClick).not.toHaveBeenCalled();
    await expect(window.location.hash).toBe(hash);
  },
};
