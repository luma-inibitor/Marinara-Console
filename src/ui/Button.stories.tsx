import type { Meta, StoryObj } from "@storybook/react-vite";
import { Button } from "./Button";
import { Confirm, ICON_SIZE, Remove } from "./icons";

// The reference component. Every state Button.tsx supports gets a story,
// because this is the file the rest of the rebuild is measured against.
const meta = {
  title: "UI/Button",
  component: Button,
  parameters: { layout: "centered" },
  args: { children: "Save changes" },
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

// ── the three ranks ───────────────────────────────────────────────────────

export const Primary: Story = { args: { variant: "primary" } };
export const Secondary: Story = { args: { variant: "secondary" } };
export const Ghost: Story = { args: { variant: "ghost" } };

// ── tone, which is category rather than rank ──────────────────────────────

export const Danger: Story = { args: { variant: "primary", tone: "danger", children: "Delete source" } };
export const Ok: Story = { args: { variant: "primary", tone: "ok", children: "Accept" } };

// ── size ──────────────────────────────────────────────────────────────────

export const Small: Story = { args: { size: "sm" } };
export const SentenceCase: Story = { args: { labelCase: "sentence" } };

// ── states ────────────────────────────────────────────────────────────────

/** Hover and focus are the same affordance reached two ways, so the story that
 *  proves one has to prove the other. Drive both from the toolbar rather than
 *  from a play function: an assertion on a colour would restate the stylesheet. */
export const Focus: Story = { args: { variant: "primary", autoFocus: true } };

/** `aria-pressed`, which overrides the resting skin whatever the variant. */
export const Pressed: Story = { args: { variant: "secondary", pressed: true, children: "Filters" } };

/** With a reason, so the control keeps its place in the tab order and a screen
 *  reader can reach the reason. This is the form the checklist prefers. */
export const DisabledWithReason: Story = {
  args: { disabled: true, disabledReason: "Nothing has changed since you opened this." },
};

/** Without a reason, so `:disabled` is honest and the button leaves the tab
 *  order entirely. The checklist calls this the last resort. */
export const DisabledNative: Story = { args: { disabled: true } };

/** The spinner waits a second, so this story shows the inert-but-unspun phase
 *  first and the spinner after. The label keeps its box either way. */
export const Pending: Story = { args: { variant: "primary", pending: true } };

// ── icons ─────────────────────────────────────────────────────────────────

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

/** `href` renders an anchor. A download link that looks like a button is still
 *  a link, and axe grades it as one. */
export const AsLink: Story = { args: { href: "#backup", download: true, children: "Download backup" } };
