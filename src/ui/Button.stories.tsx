import type { Meta, StoryObj } from "@storybook/react-vite";
import { Button } from "./Button";
import { Confirm, ICON_SIZE, Remove } from "./icons";

const meta = {
  title: "UI/Button",
  component: Button,
  parameters: { layout: "centered" },
  args: { children: "Save changes" },
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Primary: Story = { args: { variant: "primary" } };
export const Secondary: Story = { args: { variant: "secondary" } };
export const Ghost: Story = { args: { variant: "ghost" } };

export const Danger: Story = { args: { variant: "primary", tone: "danger", children: "Delete source" } };
export const Ok: Story = { args: { variant: "primary", tone: "ok", children: "Accept" } };

export const Small: Story = { args: { size: "sm" } };
export const SentenceCase: Story = { args: { labelCase: "sentence" } };

export const Focus: Story = { args: { variant: "primary", autoFocus: true } };

export const Pressed: Story = { args: { variant: "secondary", pressed: true, children: "Filters" } };

export const DisabledWithReason: Story = {
  args: { disabled: true, disabledReason: "Nothing has changed since you opened this." },
};

export const DisabledNative: Story = { args: { disabled: true } };

// The spinner appears after a second.
export const Pending: Story = { args: { variant: "primary", pending: true } };

export const WithIcon: Story = {
  args: { variant: "primary", icon: <Confirm size={ICON_SIZE.md} />, children: "Accept" },
};

export const IconOnly: Story = {
  args: { iconOnly: true, label: "Delete source", icon: <Remove size={ICON_SIZE.md} />, tone: "danger" },
};

export const FullWidth: Story = {
  args: { variant: "primary", fullWidth: true },
  parameters: { layout: "padded" },
};

export const AsLink: Story = { args: { href: "#backup", download: true, children: "Download backup" } };
