import { useRef, useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, waitFor, within } from "storybook/test";
import { Menu } from "./Menu";
import { ICON_SIZE, More } from "./icons";
import { closeTopOverlay } from "../shell/overlays";

function MenuDemo() {
  const [open, setOpen] = useState(false);
  const [chosen, setChosen] = useState("nothing yet");
  const trigger = useRef<HTMLButtonElement>(null);
  return (
    <div className="flex items-center gap-3 p-3">
      <button
        ref={trigger}
        type="button"
        className="inline-flex min-h-tap w-tap items-center justify-center rounded-sm border border-edge text-dim"
        aria-label="More actions for Harbour fog"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => (open ? closeTopOverlay() : setOpen(true))}
      >
        <More size={ICON_SIZE.lg} stroke={1.75} aria-hidden />
      </button>
      <span className="text-prose text-dim">
        chosen: <output>{chosen}</output>
      </span>
      <Menu
        open={open}
        anchor={trigger}
        label="More actions for Harbour fog"
        align="end"
        onClose={() => setOpen(false)}
        items={[
          { id: "open", label: "Open memory", onSelect: () => setChosen("open") },
          { id: "clear", label: "Clear 3 decisions", onSelect: () => setChosen("clear") },
          { id: "link", label: "Copy link", onSelect: () => setChosen("link") },
        ]}
      />
    </div>
  );
}

const meta = {
  title: "UI/Menu",
  component: MenuDemo,
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof MenuDemo>;

export default meta;
type Story = StoryObj<typeof meta>;

const open = async (canvasElement: HTMLElement) => {
  const trigger = within(canvasElement).getByRole("button", { name: /more actions/i });
  await userEvent.click(trigger);
  const menu = await within(document.body).findByRole("menu");
  const item = (name: string) => within(menu).getByRole("menuitem", { name });
  return { trigger, menu, item };
};

export const Closed: Story = {};

export const Open: Story = {
  play: async ({ canvasElement }) => {
    const { trigger, item } = await open(canvasElement);
    await expect(trigger).toHaveAttribute("aria-expanded", "true");
    await waitFor(() => expect(item("Open memory")).toHaveFocus());
  },
};

export const Keyboard: Story = {
  play: async ({ canvasElement, step }) => {
    const { item } = await open(canvasElement);
    await waitFor(() => expect(item("Open memory")).toHaveFocus());

    await step("arrows move between items", async () => {
      await userEvent.keyboard("{ArrowDown}");
      await expect(item("Clear 3 decisions")).toHaveFocus();
      await userEvent.keyboard("{ArrowUp}");
      await expect(item("Open memory")).toHaveFocus();
    });

    await step("arrows wrap at both ends", async () => {
      await userEvent.keyboard("{ArrowUp}");
      await expect(item("Copy link")).toHaveFocus();
      await userEvent.keyboard("{ArrowDown}");
      await expect(item("Open memory")).toHaveFocus();
    });

    await step("Home and End jump", async () => {
      await userEvent.keyboard("{End}");
      await expect(item("Copy link")).toHaveFocus();
      await userEvent.keyboard("{Home}");
      await expect(item("Open memory")).toHaveFocus();
    });
  },
};

export const Activate: Story = {
  play: async ({ canvasElement, step }) => {
    const canvas = within(canvasElement);
    const { trigger, item } = await open(canvasElement);
    await waitFor(() => expect(item("Open memory")).toHaveFocus());

    await step("Enter runs the item and closes the menu", async () => {
      await userEvent.keyboard("{ArrowDown}");
      await userEvent.keyboard("{Enter}");
      await waitFor(() => expect(within(document.body).queryByRole("menu")).toBeNull());
      await waitFor(() => expect(canvas.getByRole("status")).toHaveTextContent("clear"));
      await waitFor(() => expect(trigger).toHaveFocus());
      await expect(trigger).toHaveAttribute("aria-expanded", "false");
    });
  },
};
