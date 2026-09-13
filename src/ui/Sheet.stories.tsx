import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, waitFor, within } from "storybook/test";
import { Button } from "./Button";
import { Modal, Sheet, SheetHead } from "./Sheet";
import { Term } from "./Term";

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
            <Term tip="claim kind · static — a fact that does not change">kind</Term>
            <Button variant="secondary" size="sm">
              Clear
            </Button>
          </div>
        </Sheet>
      )}
    </div>
  );
}

function ModalDemo() {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <Button variant="primary" onClick={() => setOpen(true)}>
        Import 12 sources
      </Button>
      {open && (
        <Modal label="Confirm import" onClose={() => setOpen(false)}>
          <p className="m-0 mb-3 font-prose text-prose">Import 12 sources? This spends model calls.</p>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" autoFocus onClick={() => setOpen(false)}>
              Import
            </Button>
          </div>
        </Modal>
      )}
    </div>
  );
}

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

export const FocusWrap: Story = {
  args: { autoFocus: false },
  play: async ({ canvasElement, step }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: /open facets/i }));
    const dialog = await canvas.findByRole("dialog", { name: "Facets" });
    const close = within(dialog).getByRole("button", { name: /close/i });
    const clear = within(dialog).getByRole("button", { name: "Clear" });
    const term = within(dialog).getByText("kind");

    await step("opens · focus lands on the first control", async () => {
      await waitFor(() => expect(close).toHaveFocus());
    });

    await step("Tab · walks the surface", async () => {
      await userEvent.tab();
      await waitFor(() => expect(term).toHaveFocus());
      await userEvent.tab();
      await waitFor(() => expect(clear).toHaveFocus());
    });

    await step("Tab from the last control · wraps to the first", async () => {
      await userEvent.tab();
      await waitFor(() => expect(close).toHaveFocus());
    });

    await step("Shift+Tab from the first control · wraps to the last", async () => {
      await userEvent.tab({ shift: true });
      await waitFor(() => expect(clear).toHaveFocus());
    });
  },
};

export const TermInside: Story = {
  play: async ({ canvasElement, step }) => {
    const canvas = within(canvasElement);
    const trigger = canvas.getByRole("button", { name: /open facets/i });
    await userEvent.click(trigger);
    const dialog = await canvas.findByRole("dialog", { name: "Facets" });

    await step("tap · the term opens its tip", async () => {
      await userEvent.click(within(dialog).getByText("kind"));
      await waitFor(() => expect(within(dialog).getByText("kind")).toHaveClass("tip-open"));
    });

    await step("Escape · the sheet closes over the open tip", async () => {
      await userEvent.keyboard("{Escape}");
      await waitFor(() => expect(canvas.queryByRole("dialog")).toBeNull());
      await waitFor(() => expect(trigger).toHaveFocus());
    });
  },
};

export const ModalOpen: Story = {
  render: () => <ModalDemo />,
  play: async ({ canvasElement, step }) => {
    const canvas = within(canvasElement);
    const trigger = canvas.getByRole("button", { name: /import 12 sources/i });

    await step("opens · focus lands on the primary", async () => {
      await userEvent.click(trigger);
      const dialog = await canvas.findByRole("dialog", { name: "Confirm import" });
      await waitFor(() => expect(within(dialog).getByRole("button", { name: "Import" })).toHaveFocus());
    });

    await step("Escape · the modal closes and focus returns", async () => {
      await userEvent.keyboard("{Escape}");
      await waitFor(() => expect(canvas.queryByRole("dialog")).toBeNull());
      await waitFor(() => expect(trigger).toHaveFocus());
    });
  },
};
