import { useRef, useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, within } from "storybook/test";
import { Button } from "./Button";
import { Tag } from "./Chip";
import { ExternalLink, ICON_SIZE } from "./icons";
import { List, ListItem } from "./ListItem";
import { useRovingFocus } from "./useRovingFocus";

const ROWS = [
  { key: "harbour", title: "Harbour fog", secondary: "world · roleplay", figure: "1.2k" },
  { key: "collar", title: "The brass collar", secondary: "world · roleplay", figure: "0.4k" },
  { key: "letters", title: "Letters from the north tower, never sent", secondary: "thread · roleplay", figure: "2.8k" },
];

const dot = <span className="size-2 rounded-full bg-type-world" aria-hidden />;

function ListDemo(props: {
  selected?: string;
  disabled?: string;
  chips?: boolean;
  action?: boolean;
  static?: boolean;
}) {
  const listRef = useRef<HTMLUListElement>(null);
  const [current, setCurrent] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(props.selected ?? null);
  const roving = useRovingFocus({ listRef, keys: ROWS.map((r) => r.key), current, onFocus: setCurrent });
  return (
    <List
      ref={listRef}
      label="Memories"
      onFocus={(ev) => {
        const key = (ev.target as HTMLElement).dataset.row;
        if (key) setCurrent(key);
      }}
      onKeyDown={(ev) => {
        if (roving.ignore(ev)) return;
        if (ev.key === "ArrowDown" || ev.key === "j") {
          ev.preventDefault();
          roving.move(1);
        } else if (ev.key === "ArrowUp" || ev.key === "k") {
          ev.preventDefault();
          roving.move(-1);
        }
      }}
    >
      {ROWS.map((r) => {
        const tab = roving.tabbable(r.key) ? 0 : -1;
        const disabled = props.disabled === r.key;
        return (
          <ListItem
            key={r.key}
            rowKey={r.key}
            tabIndex={tab}
            leading={dot}
            title={r.title}
            secondary={disabled ? "archived · open it from the archive" : r.secondary}
            trailing={
              props.chips ? (
                <>
                  <Tag>near limit</Tag>
                  <Tag>edited</Tag>
                  <span className="t-num text-data text-dim">{r.figure}</span>
                </>
              ) : (
                <span className="t-num text-data text-dim">{r.figure}</span>
              )
            }
            action={
              props.action && (
                <Button
                  iconOnly
                  variant="ghost"
                  tabIndex={tab}
                  label={`Open ${r.title} in lorebooks`}
                  icon={<ExternalLink size={ICON_SIZE.md} stroke={1.75} aria-hidden />}
                />
              )
            }
            selected={open === r.key}
            disabled={disabled}
            onActivate={props.static ? undefined : () => setOpen(r.key)}
          />
        );
      })}
    </List>
  );
}

const meta = {
  title: "UI/ListItem",
  component: ListDemo,
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof ListDemo>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Selected: Story = { args: { selected: "collar" } };

export const Disabled: Story = { args: { disabled: "collar" } };

export const WithChips: Story = { args: { chips: true } };

export const WithAction: Story = { args: { action: true } };

export const Static: Story = { args: { static: true } };

export const Dense: Story = { globals: { density: "compact" } };

export const Keyboard: Story = {
  play: async ({ canvasElement, step }) => {
    const canvas = within(canvasElement);
    const row = (title: string) => canvas.getByRole("button", { name: new RegExp(title) });

    await step("Tab enters the list on its one stop", async () => {
      await userEvent.tab();
      await expect(row("Harbour fog")).toHaveFocus();
    });

    await step("arrows move within the list", async () => {
      await userEvent.keyboard("{ArrowDown}");
      await userEvent.keyboard("{ArrowDown}");
      await expect(row("Letters from")).toHaveFocus();
      await userEvent.keyboard("{ArrowUp}");
      await expect(row("The brass collar")).toHaveFocus();
    });

    await step("Enter activates the primary target", async () => {
      await userEvent.keyboard("{Enter}");
      await expect(row("The brass collar")).toHaveAttribute("aria-current", "true");
    });

    await step("Tab leaves the list", async () => {
      await userEvent.tab();
      await expect(canvasElement.contains(document.activeElement)).toBe(false);
    });
  },
};
