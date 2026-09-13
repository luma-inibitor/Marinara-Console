import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, within } from "storybook/test";
import { Button } from "./Button";
import { EmptyState } from "./EmptyState";
import { AllClear, Failure, ICON_SIZE, NoMatches } from "./icons";

const meta = {
  title: "UI/EmptyState",
  component: EmptyState,
  parameters: { layout: "centered" },
  decorators: [(Story) => <div style={{ width: 420 }}>{Story()}</div>],
  args: {
    icon: <NoMatches size={ICON_SIZE.hero} stroke={1.75} aria-hidden />,
    title: "No matching sources",
    body: (
      <>
        Nothing matches <b>fog</b> in this scope.
      </>
    ),
  },
} satisfies Meta<typeof EmptyState>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("No matching sources")).toBeVisible();
    await expect(canvas.queryByRole("button")).toBeNull();
  },
};

export const WithAction: Story = {
  args: {
    title: "No lorebooks in this scope",
    body: "Widen the scope to see every lorebook.",
    actions: <Button onClick={fn()}>Import scope: all chats</Button>,
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const button = canvas.getByRole("button", { name: /import scope/i });
    await userEvent.click(button);
    await expect((args.actions as { props: { onClick: ReturnType<typeof fn> } }).props.onClick).toHaveBeenCalled();
  },
};

export const TitleOnly: Story = { args: { icon: undefined, body: undefined } };

export const Ok: Story = {
  args: {
    tone: "ok",
    icon: <AllClear size={ICON_SIZE.hero} stroke={1.75} aria-hidden />,
    title: "Nothing is ready to import",
    body: "Every source in this scope has been imported.",
  },
};

export const Danger: Story = {
  args: {
    tone: "danger",
    icon: <Failure size={ICON_SIZE.hero} stroke={1.75} aria-hidden />,
    title: "Three extractions failed",
    body: "Retry them from the sources list.",
  },
};
