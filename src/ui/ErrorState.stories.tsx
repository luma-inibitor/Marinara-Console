import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, within } from "storybook/test";
import { ErrorState } from "./ErrorState";
import { ApiError } from "../shell/api";
import { t } from "../copy";

const meta = {
  title: "UI/ErrorState",
  component: ErrorState,
  parameters: { layout: "centered" },
  decorators: [(Story) => <div style={{ width: 420 }}>{Story()}</div>],
} satisfies Meta<typeof ErrorState>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Offline: Story = {
  args: { error: new ApiError("fetch failed", { status: 0, offline: true }) },
};

export const Forbidden: Story = {
  args: { error: new ApiError("Forbidden", { status: 403 }) },
};

export const NotFound: Story = {
  args: { error: new ApiError("No such lorebook", { status: 404 }) },
};

export const ServerFault: Story = {
  args: { error: new ApiError("Internal Server Error", { status: 500 }) },
};

export const Unknown: Story = {
  args: { message: "The response was not JSON." },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.queryByRole("button")).toBeNull();
  },
};

export const WithRetry: Story = {
  args: { error: new ApiError("Bad Gateway", { status: 502 }), onRetry: fn() },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const button = canvas.getByRole("button", { name: t("ui.error.tryAgain") });
    await userEvent.click(button);
    await expect(args.onRetry).toHaveBeenCalledOnce();
  },
};
