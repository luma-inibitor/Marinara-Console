import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, waitFor, within } from "storybook/test";
import { Picker, type PickerOption } from "./Picker";
import { GroupBy } from "./icons";

const GROUPERS: PickerOption[] = [
  { id: "target", label: "target memory", hint: 4 },
  { id: "source", label: "sources", hint: 2 },
  { id: "disposition", label: "disposition", hint: 3 },
  { id: "kind", label: "change kind", hint: 2 },
  { id: "none", label: "nothing" },
];

const FLAGS: PickerOption[] = [
  { id: "restates", label: "restates" },
  { id: "duplicate", label: "duplicate" },
  { id: "conflicts", label: "conflicts" },
];

const LONG: PickerOption[] = Array.from({ length: 24 }, (_, i) => ({ id: `w${i}`, label: `week ${i + 1}` }));

function SingleDemo(props: { options: PickerOption[]; size?: "sm" | "md" }) {
  const [value, setValue] = useState((props.options[1] ?? props.options[0])!.id);
  return (
    <div className="flex items-center gap-3 p-3">
      <Picker
        label="Group by"
        icon={GroupBy}
        options={props.options}
        value={value}
        onChange={setValue}
        size={props.size}
      />
      <span className="text-prose text-dim">
        chosen: <output>{value}</output>
      </span>
    </div>
  );
}

function MultiDemo() {
  const [value, setValue] = useState<string[]>([]);
  return (
    <div className="flex items-center gap-3 p-3">
      <Picker multi label="Flags" noneLabel="any flag" options={FLAGS} value={value} onChange={setValue} />
      <span className="text-prose text-dim">
        chosen: <output>{value.join(" ") || "none"}</output>
      </span>
    </div>
  );
}

const meta = {
  title: "UI/Picker",
  component: SingleDemo,
  parameters: { layout: "fullscreen" },
  args: { options: GROUPERS },
} satisfies Meta<typeof SingleDemo>;

export default meta;
type Story = StoryObj<typeof meta>;

const open = async (canvasElement: HTMLElement, name: RegExp) => {
  const trigger = within(canvasElement).getByRole("button", { name });
  await userEvent.click(trigger);
  const menu = await within(document.body).findByRole("menu");
  return { trigger, menu };
};

export const Single: Story = {
  play: async ({ canvasElement, step }) => {
    const canvas = within(canvasElement);
    const { trigger, menu } = await open(canvasElement, /^Group by: sources/);
    const radio = (name: string) => within(menu).getByRole("menuitemradio", { name: new RegExp(`^${name}`) });

    await step("opens · the current choice is checked and focused", async () => {
      await expect(radio("sources")).toHaveAttribute("aria-checked", "true");
      await expect(radio("target memory")).toHaveAttribute("aria-checked", "false");
      await waitFor(() => expect(radio("sources")).toHaveFocus());
    });

    await step("arrow and Enter choose · the menu closes", async () => {
      await userEvent.keyboard("{ArrowDown}");
      await expect(radio("disposition")).toHaveFocus();
      await userEvent.keyboard("{Enter}");
      await waitFor(() => expect(within(document.body).queryByRole("menu")).toBeNull());
      await waitFor(() => expect(canvas.getByRole("status")).toHaveTextContent("disposition"));
    });

    await step("closes · the trigger reads the new choice and holds focus", async () => {
      await waitFor(() => expect(trigger).toHaveFocus());
      await expect(trigger).toHaveAccessibleName("Group by: disposition");
      await expect(trigger).toHaveAttribute("aria-expanded", "false");
    });
  },
};

export const Multi: StoryObj = {
  render: () => <MultiDemo />,
  play: async ({ canvasElement, step }) => {
    const canvas = within(canvasElement);
    const { trigger, menu } = await open(canvasElement, /^Flags: any flag/);
    const box = (name: string) => within(menu).getByRole("menuitemcheckbox", { name });

    await step("Space toggles a checkbox · the menu stays open", async () => {
      await waitFor(() => expect(box("restates")).toHaveFocus());
      await userEvent.keyboard(" ");
      await expect(box("restates")).toHaveAttribute("aria-checked", "true");
      await expect(within(document.body).getByRole("menu")).toBeVisible();
      await expect(canvas.getByRole("status")).toHaveTextContent("restates");
    });

    await step("a second toggle adds to the choice", async () => {
      await userEvent.keyboard("{ArrowDown}{ArrowDown}");
      await userEvent.keyboard("{Enter}");
      await expect(box("conflicts")).toHaveAttribute("aria-checked", "true");
      await expect(trigger).toHaveAccessibleName("Flags: restates, conflicts");
    });

    await step("Escape closes · focus returns to the trigger", async () => {
      await userEvent.keyboard("{Escape}");
      await waitFor(() => expect(within(document.body).queryByRole("menu")).toBeNull());
      await waitFor(() => expect(trigger).toHaveFocus());
    });
  },
};

export const LongList: Story = {
  args: { options: LONG },
  play: async ({ canvasElement }) => {
    const { menu } = await open(canvasElement, /^Group by: week 2$/);
    await userEvent.keyboard("{End}");
    await expect(within(menu).getByRole("menuitemradio", { name: "week 24" })).toHaveFocus();
  },
};

export const DisabledOption: Story = {
  args: {
    options: [
      { id: "target", label: "target memory", hint: 4 },
      { id: "none", label: "nothing" },
      { id: "source", label: "sources", disabledReason: "no sources in scope" },
    ],
  },
  play: async ({ canvasElement, step }) => {
    const canvas = within(canvasElement);
    const { menu } = await open(canvasElement, /^Group by: nothing/);
    const radio = (name: RegExp) => within(menu).getByRole("menuitemradio", { name });

    await step("the disabled option stays reachable and says why", async () => {
      await userEvent.keyboard("{ArrowDown}");
      await expect(radio(/^sources/)).toHaveFocus();
      await expect(radio(/^sources/)).toHaveAttribute("aria-disabled", "true");
      await expect(radio(/^sources/)).toHaveTextContent("no sources in scope");
    });

    await step("Enter on it does nothing", async () => {
      await userEvent.keyboard("{Enter}");
      await expect(within(document.body).getByRole("menu")).toBeVisible();
      await expect(canvas.getByRole("status")).toHaveTextContent("none");
    });
  },
};

export const Tall: Story = {
  args: { size: "md" },
};
