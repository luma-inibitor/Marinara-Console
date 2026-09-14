import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, waitFor, within } from "storybook/test";
import { Button } from "./Button";
import { FullscreenText } from "./FullscreenText";

const INITIAL = "Ada Lovelace wrote the first program for a machine that was never built.";
const MORE = " Nobody ran it.";

function EditorDemo(props: { budget?: number }) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(INITIAL);
  return (
    <div className="p-3">
      <Button variant="primary" onClick={() => setOpen(true)}>
        Edit content
      </Button>
      <p data-testid="value" className="m-0 mt-3 font-data text-data whitespace-pre-wrap text-dim">
        {value}
      </p>
      {open && (
        <FullscreenText
          title="Content"
          subtitle="Ada Lovelace"
          initial={value}
          budget={props.budget}
          onDone={(next) => {
            setValue(next);
            setOpen(false);
          }}
          onCancel={() => setOpen(false)}
        />
      )}
    </div>
  );
}

const meta: Meta<typeof EditorDemo> = {
  title: "UI/FullscreenText",
  component: EditorDemo,
  args: { budget: 2000 },
  parameters: { layout: "fullscreen" },
};

export default meta;
type Story = StoryObj<typeof meta>;

/** Opens the editor from the demo's trigger and hands back the parts every story reads. */
async function openEditor(canvasElement: HTMLElement) {
  const canvas = within(canvasElement);
  const trigger = canvas.getByRole("button", { name: /edit content/i });
  await userEvent.click(trigger);
  const dialog = await canvas.findByRole("dialog", { name: "Content" });
  const textbox = within(dialog).getByRole("textbox", { name: "Content" }) as HTMLTextAreaElement;
  const closed = async () => {
    await waitFor(() => expect(canvas.queryByRole("dialog")).toBeNull());
    await waitFor(() => expect(trigger).toHaveFocus());
  };
  return { canvas, trigger, dialog, textbox, closed };
}

export const Closed: Story = {};

export const Open: Story = {
  play: async ({ canvasElement }) => {
    const { textbox } = await openEditor(canvasElement);
    await expect(textbox).toHaveValue(INITIAL);
  },
};

export const FocusContract: Story = {
  play: async ({ canvasElement, step }) => {
    const { textbox, closed } = await openEditor(canvasElement);

    await step("opens · focus lands in the textarea", async () => {
      await waitFor(() => expect(textbox).toHaveFocus());
    });

    await step("Escape on a clean editor · closes and focus returns to the trigger", async () => {
      await userEvent.keyboard("{Escape}");
      await closed();
    });
  },
};

export const DirtyDiscard: Story = {
  play: async ({ canvasElement, step }) => {
    const { canvas, dialog, textbox, closed } = await openEditor(canvasElement);
    const discard = () => within(dialog).getByRole("button", { name: /discard/i });

    await step("typing · marks the editor unsaved", async () => {
      await userEvent.type(textbox, MORE);
      await within(dialog).findByText("unsaved");
    });

    await step("Escape on a dirty editor · asks before discarding", async () => {
      await userEvent.keyboard("{Escape}");
      await canvas.findByRole("alertdialog");
      await waitFor(() => expect(discard()).toHaveFocus());
    });

    await step("Escape again · dismisses the question and keeps the editor", async () => {
      await userEvent.keyboard("{Escape}");
      await waitFor(() => expect(canvas.queryByRole("alertdialog")).toBeNull());
      await expect(dialog).toBeVisible();
      await waitFor(() => expect(textbox).toHaveFocus());
    });

    await step("Cancel · asks again, and Discard closes without applying", async () => {
      await userEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));
      await canvas.findByRole("alertdialog");
      await userEvent.click(discard());
      await closed();
      await expect(canvas.getByTestId("value")).toHaveTextContent(INITIAL);
    });
  },
};

export const Commit: Story = {
  play: async ({ canvasElement, step }) => {
    const { canvas, trigger, textbox, closed } = await openEditor(canvasElement);

    await step("Ctrl+Enter · applies the edit and returns focus", async () => {
      await userEvent.type(textbox, MORE);
      await userEvent.keyboard("{Control>}{Enter}{/Control}");
      await closed();
      await expect(canvas.getByTestId("value")).toHaveTextContent(INITIAL + MORE);
    });

    await step("Done · applies the edit too", async () => {
      await userEvent.click(trigger);
      const again = await canvas.findByRole("dialog", { name: "Content" });
      await userEvent.type(within(again).getByRole("textbox", { name: "Content" }), " Twice.");
      await userEvent.click(within(again).getByRole("button", { name: "Done" }));
      await closed();
      await expect(canvas.getByTestId("value")).toHaveTextContent(`${INITIAL}${MORE} Twice.`);
    });
  },
};

export const SymbolRow: Story = {
  play: async ({ canvasElement, step }) => {
    const { dialog, textbox } = await openEditor(canvasElement);

    await step("a symbol button · is named for what it inserts", async () => {
      const row = within(dialog).getByRole("group", { name: "Markdown symbols" });
      await expect(within(row).getByRole("button", { name: "Bold" })).toHaveTextContent("**");
      await expect(within(row).getByRole("button", { name: "New line" })).toHaveTextContent("↵");
    });

    await step("pressing one · inserts at the caret and refocuses the textarea", async () => {
      textbox.setSelectionRange(0, 0);
      await userEvent.click(within(dialog).getByRole("button", { name: "Heading" }));
      await waitFor(() => expect(textbox).toHaveValue(`# ${INITIAL}`));
      await waitFor(() => expect(textbox).toHaveFocus());
      await expect(textbox.selectionStart).toBe(2);
    });

    await step("wrap · is a toggle", async () => {
      const wrap = within(dialog).getByRole("button", { name: /wrap/i });
      await expect(wrap).toHaveAttribute("aria-pressed", "true");
      await userEvent.click(wrap);
      await expect(wrap).toHaveAttribute("aria-pressed", "false");
    });
  },
};
