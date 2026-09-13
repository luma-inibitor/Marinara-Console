import { useRef, useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, waitFor, within } from "storybook/test";
import { Button } from "./Button";
import { Popover, type Align, type Side } from "./Popover";
import { closeTopOverlay } from "../shell/overlays";

function PopoverDemo(props: { side?: Side; align?: Align; at?: "bottom" | "end"; initialFocus?: "first" | "surface" }) {
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  return (
    <div
      className={props.at === "bottom" ? "fixed bottom-2 left-2" : props.at === "end" ? "flex justify-end p-3" : "p-3"}
    >
      <button
        ref={trigger}
        type="button"
        className="min-h-tap rounded-m border border-edge-strong px-4 text-ink"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => (open ? closeTopOverlay() : setOpen(true))}
      >
        Scope
      </button>
      <Popover
        open={open}
        anchor={trigger}
        label="Scope"
        side={props.side}
        align={props.align}
        initialFocus={props.initialFocus}
        className="w-[240px] p-2"
        onClose={() => setOpen(false)}
      >
        <p className="m-0 mb-2 text-prose text-dim">Choose a chat.</p>
        <Button variant="secondary" size="sm" fullWidth>
          Tuesday crossing
        </Button>
        <Button variant="secondary" size="sm" fullWidth className="mt-1">
          Harbour fog
        </Button>
      </Popover>
    </div>
  );
}

const meta = {
  title: "UI/Popover",
  component: PopoverDemo,
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof PopoverDemo>;

export default meta;
type Story = StoryObj<typeof meta>;

const open = async (canvasElement: HTMLElement) => {
  const trigger = within(canvasElement).getByRole("button", { name: "Scope" });
  await userEvent.click(trigger);
  const surface = await within(document.body).findByRole("dialog", { name: "Scope" });
  return { trigger, surface };
};

export const Closed: Story = {};

export const Open: Story = {
  play: async ({ canvasElement, step }) => {
    const { trigger, surface } = await open(canvasElement);
    await step("opens below the trigger · focus lands on the first control", async () => {
      await expect(surface).toHaveAttribute("data-side", "bottom");
      await expect(trigger).toHaveAttribute("aria-expanded", "true");
      await waitFor(() => expect(within(surface).getByRole("button", { name: "Tuesday crossing" })).toHaveFocus());
    });
  },
};

export const AlignedEnd: Story = {
  args: { align: "end", at: "end" },
  play: async ({ canvasElement }) => {
    const { trigger, surface } = await open(canvasElement);
    await waitFor(() => {
      const a = trigger.getBoundingClientRect();
      const s = surface.getBoundingClientRect();
      expect(Math.round(s.right)).toBe(Math.round(a.right));
    });
  },
};

export const FlippedAtViewportEdge: Story = {
  args: { at: "bottom" },
  play: async ({ canvasElement, step }) => {
    const { trigger, surface } = await open(canvasElement);
    await step("no room below · the surface opens above", async () => {
      await expect(surface).toHaveAttribute("data-side", "top");
      await waitFor(() =>
        expect(surface.getBoundingClientRect().bottom).toBeLessThan(trigger.getBoundingClientRect().top),
      );
    });
  },
};

export const FocusOnSurface: Story = {
  args: { initialFocus: "surface" },
  play: async ({ canvasElement, step }) => {
    const { surface } = await open(canvasElement);
    await step("opens · the surface itself holds focus", async () => {
      await waitFor(() => expect(surface).toHaveFocus());
    });
    await step("Tab · reaches the first control", async () => {
      await userEvent.tab();
      await waitFor(() => expect(within(surface).getByRole("button", { name: "Tuesday crossing" })).toHaveFocus());
    });
  },
};

export const OutsideClick: Story = {
  play: async ({ canvasElement, step }) => {
    const { trigger } = await open(canvasElement);
    await step("click outside · the popover closes", async () => {
      await userEvent.click(document.querySelector("[data-popover-scrim]")!);
      await waitFor(() => expect(within(document.body).queryByRole("dialog")).toBeNull());
    });
    await step("closes · focus returns to the trigger", async () => {
      await waitFor(() => expect(trigger).toHaveFocus());
      await expect(trigger).toHaveAttribute("aria-expanded", "false");
    });
  },
};

export const Escape: Story = {
  play: async ({ canvasElement, step }) => {
    const { trigger } = await open(canvasElement);
    await step("Escape · the popover closes and focus returns to the trigger", async () => {
      await userEvent.keyboard("{Escape}");
      await waitFor(() => expect(within(document.body).queryByRole("dialog")).toBeNull());
      await waitFor(() => expect(trigger).toHaveFocus());
    });
  },
};
