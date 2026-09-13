import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, waitFor, within } from "storybook/test";
import { Button } from "./Button";
import { FacetDrawer, FacetGroup, type FacetGroupModel } from "./FacetDrawer";

type Row = Record<string, string | string[] | undefined>;

interface GroupDef {
  id: string;
  label: string;
  layout?: "grid" | "list" | "tiles";
  flag?: boolean;
}

const TYPES = ["character", "relationship", "timeline event", "thread", "world", "tone"];
const STATUSES = ["undecided", "keep", "drop"];
const DISPOSITIONS = ["new", "merge", "rewrite"];
const FLAGS = ["restates vault", "duplicate incoming", "conflicts", "long", "over cap"];

const ROWS: Row[] = Array.from({ length: 24 }, (_, i) => ({
  type: TYPES[i % TYPES.length],
  status: STATUSES[i % 5 === 0 ? 1 : i % 7 === 0 ? 2 : 0],
  disposition: DISPOSITIONS[i % 3],
  flags: i % 4 === 0 ? [FLAGS[i % FLAGS.length], FLAGS[(i + 1) % FLAGS.length]] : undefined,
  source: `Source ${String(i % 30).padStart(2, "0")}`,
}));

const MANY_SOURCES: Row[] = Array.from({ length: 60 }, (_, i) => ({ source: `Chapter ${i + 1}` }));

const GROUPS: GroupDef[] = [
  { id: "flags", label: "quality flags", layout: "list", flag: true },
  { id: "type", label: "memory type", layout: "tiles" },
  { id: "status", label: "decision", layout: "tiles" },
  { id: "disposition", label: "disposition" },
];

const valuesOf = (row: Row, id: string): string[] => {
  const v = row[id];
  return v == null ? [] : Array.isArray(v) ? v : [v];
};

const matches = (row: Row, active: Map<string, Set<string>>, skip?: string) =>
  [...active].every(([id, set]) => id === skip || !set.size || valuesOf(row, id).some((v) => set.has(v)));

function build(rows: Row[], defs: GroupDef[], active: Map<string, Set<string>>): FacetGroupModel[] {
  return defs.map((d) => {
    const counts = new Map<string, number>();
    for (const row of rows) for (const v of valuesOf(row, d.id)) counts.set(v, 0);
    for (const row of rows)
      if (matches(row, active, d.id)) for (const v of valuesOf(row, d.id)) counts.set(v, (counts.get(v) ?? 0) + 1);
    for (const v of active.get(d.id) ?? []) if (!counts.has(v)) counts.set(v, 0);
    const values = [...counts]
      .sort((a, b) => b[1] - a[1])
      .map(([value, count]) => ({ value, label: value, count, on: active.get(d.id)?.has(value) ?? false }));
    return { id: d.id, label: d.label, values };
  });
}

function Demo(props: { rows: Row[]; defs: GroupDef[]; initial?: [string, string][] }) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(() => {
    const m = new Map<string, Set<string>>();
    for (const [id, v] of props.initial ?? []) m.set(id, new Set([...(m.get(id) ?? []), v]));
    return m;
  });
  const toggle = (id: string, value: string) => {
    const next = new Map(active);
    const set = new Set(next.get(id) ?? []);
    set.has(value) ? set.delete(value) : set.add(value);
    next.set(id, set);
    setActive(next);
  };
  const groups = build(props.rows, props.defs, active);
  const shown = props.rows.filter((r) => matches(r, active)).length;
  let activeCount = 0;
  for (const set of active.values()) activeCount += set.size;
  return (
    <div>
      <Button variant="primary" onClick={() => setOpen(true)}>
        Open facets
      </Button>
      {open && (
        <FacetDrawer
          label="Filter"
          title="Filter"
          activeCount={activeCount}
          onClear={() => setActive(new Map())}
          onClose={() => setOpen(false)}
          result={
            <output>
              {shown} of {props.rows.length} claims
            </output>
          }
        >
          {groups.map((g, i) => (
            <FacetGroup
              key={g.id}
              group={g}
              layout={props.defs[i].layout}
              flag={props.defs[i].flag}
              onToggle={(v) => toggle(g.id, v)}
            />
          ))}
        </FacetDrawer>
      )}
    </div>
  );
}

const meta = {
  title: "UI/FacetDrawer",
  component: Demo,
  parameters: { layout: "fullscreen" },
  args: { rows: ROWS, defs: GROUPS },
} satisfies Meta<typeof Demo>;

export default meta;
type Story = StoryObj<typeof meta>;

const open = async (canvasElement: HTMLElement) => {
  const trigger = within(canvasElement).getByRole("button", { name: /open facets/i });
  await userEvent.click(trigger);
  const dialog = await within(canvasElement).findByRole("dialog", { name: "Filter" });
  return { trigger, dialog, in: within(dialog) };
};

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const { in: d } = await open(canvasElement);
    await expect(d.getByRole("group", { name: /^memory type/ })).toBeVisible();
    await expect(d.getByText("none active")).toBeVisible();
  },
};

export const Empty: Story = {
  args: { rows: [] },
  play: async ({ canvasElement }) => {
    const { in: d } = await open(canvasElement);
    await expect(d.getAllByRole("group")).toHaveLength(GROUPS.length);
    await expect(d.queryByRole("button", { pressed: false })).toBeNull();
    await expect(d.getByRole("status")).toHaveTextContent("0 of 0 claims");
  },
};

export const ManyValues: Story = {
  args: { rows: MANY_SOURCES, defs: [{ id: "source", label: "sources", layout: "list" }] },
  play: async ({ canvasElement }) => {
    const { in: d } = await open(canvasElement);
    await expect(d.getAllByRole("button", { pressed: false })).toHaveLength(60);
  },
};

export const AllCleared: Story = {
  args: {
    initial: [
      ["type", "character"],
      ["status", "keep"],
      ["flags", "conflicts"],
    ],
  },
  play: async ({ canvasElement, step }) => {
    const { in: d } = await open(canvasElement);
    await expect(d.getByText("3 active")).toBeVisible();
    await expect(d.getAllByRole("button", { pressed: true })).toHaveLength(3);

    await step("Clear all · every value is off and the tally says so", async () => {
      await userEvent.click(d.getByRole("button", { name: "Clear all" }));
      await waitFor(() => expect(d.queryByRole("button", { pressed: true })).toBeNull());
      await expect(d.getByText("none active")).toBeVisible();
      await expect(d.queryByRole("button", { name: "Clear all" })).toBeNull();
      await expect(d.getByRole("status")).toHaveTextContent("24 of 24 claims");
    });
  },
};

export const Keyboard: Story = {
  play: async ({ canvasElement, step }) => {
    const { in: d } = await open(canvasElement);
    const character = d.getByRole("button", { name: /^character/ });
    const keep = d.getByRole("button", { name: /^keep/ });
    const keepBefore = keep.textContent;

    await step("Tab reaches a value and Space presses it", async () => {
      await waitFor(() => expect(d.getByRole("button", { name: /close/i })).toHaveFocus());
      while (document.activeElement !== character) await userEvent.tab();
      await userEvent.keyboard(" ");
      await waitFor(() => expect(character).toHaveAttribute("aria-pressed", "true"));
    });

    await step("the other groups recount and the head says one is active", async () => {
      await waitFor(() => expect(keep.textContent).not.toBe(keepBefore));
      await expect(d.getByText("1 active")).toBeVisible();
      await expect(d.getByRole("status")).toHaveTextContent("4 of 24 claims");
    });

    await step("Space again releases it", async () => {
      await userEvent.keyboard(" ");
      await waitFor(() => expect(character).toHaveAttribute("aria-pressed", "false"));
      await expect(keep.textContent).toBe(keepBefore);
    });
  },
};

export const FocusContract: Story = {
  play: async ({ canvasElement }) => {
    const { trigger, dialog } = await open(canvasElement);
    await waitFor(() => expect(dialog).toContainElement(document.activeElement as HTMLElement));
    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(within(canvasElement).queryByRole("dialog")).toBeNull());
    await waitFor(() => expect(trigger).toHaveFocus());
  },
};
