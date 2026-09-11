import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, waitFor, within } from "storybook/test";
import { Button } from "./Button";
import { Sheet, SheetHead } from "./Sheet";

/** A sheet has no standalone form: it is opened by something and it closes back
 *  to that something, so the story renders the trigger as well as the surface.
 *  Declared outside the story so it is an ordinary component and its state
 *  survives a re-render. */
function SheetDemo(props: { autoFocus?: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <Button variant="primary" onClick={() => setOpen(true)}>
        Open facets
      </Button>
      {open && (
        <Sheet label="Facets" onClose={() => setOpen(false)}>
          <SheetHead title="Facets" autoFocus={props.autoFocus} />
          <div className="p-3">
            <Button variant="secondary" size="sm">
              Clear
            </Button>
          </div>
        </Sheet>
      )}
    </div>
  );
}

// An overlay, so the harness has to survive a surface that opens over the
// story rather than sitting in it. This is also where a play function earns
// its place: component-checklist.md §5's focus contract is three assertions
// about what happens between two renders, which no static check can reach.
//
// `component` names the wrapper rather than `Sheet`, because a Sheet cannot
// render on its own: it takes an `onClose` that has to clear the state that
// mounts it, so the thing with a default state is the pair.
const meta = {
  title: "UI/Sheet",
  component: SheetDemo,
  parameters: { layout: "fullscreen" },
  args: { autoFocus: true },
} satisfies Meta<typeof SheetDemo>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Closed: Story = {};

export const Open: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: /open facets/i }));
    await canvas.findByRole("dialog", { name: "Facets" });
  },
};

/** The focus contract from component-checklist.md §5, asserted in the order the
 *  checklist writes it: focus moves into the surface on open, Escape closes it,
 *  focus returns to the trigger.
 *
 *  The third assertion FAILS today, and is left failing on purpose. React runs
 *  a child's effect before its parent's, so `SheetHead`'s autoFocus effect has
 *  already moved focus to the close button by the time `Overlay`'s effect calls
 *  `openOverlay`. The stack therefore records the close button as the element
 *  to restore to, and that element unmounts with the sheet — `isConnected` is
 *  false in `settle()`, no restore runs, and focus falls to `<body>`. A sheet
 *  with no `autoFocus` restores correctly, which is what pins the cause.
 *
 *  Fixing it belongs to src/shell/overlays.ts or src/ui/Sheet.tsx, not here. */
export const FocusContract: Story = {
  play: async ({ canvasElement, step }) => {
    const canvas = within(canvasElement);
    const trigger = canvas.getByRole("button", { name: /open facets/i });

    await step("opens · focus moves into the surface", async () => {
      await userEvent.click(trigger);
      const dialog = await canvas.findByRole("dialog", { name: "Facets" });
      await waitFor(() => expect(dialog).toContainElement(document.activeElement as HTMLElement));
    });

    await step("Escape · the surface closes", async () => {
      await userEvent.keyboard("{Escape}");
      await waitFor(() => expect(canvas.queryByRole("dialog")).toBeNull());
    });

    await step("closes · focus returns to the trigger", async () => {
      await waitFor(() => expect(trigger).toHaveFocus());
    });
  },
};
