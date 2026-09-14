import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, within } from "storybook/test";
import { SaveBar } from "./SaveBar";
import { t } from "../copy";
import type { Draft } from "../shell/draft";

type Row = { id: string };

const BASE: Row = { id: "e1" };

function draft(over: Partial<Draft<Row>> = {}): Draft<Row> {
  return {
    value: BASE,
    patch: {},
    dirty: false,
    dirtyFields: [],
    saving: false,
    error: null,
    fieldErrors: {},
    conflict: null,
    set: fn(),
    merge: fn(),
    save: fn(async () => true),
    cancel: fn(),
    rebase: fn(),
    takeTheirs: fn(),
    keepMine: fn(),
    ...over,
  };
}

const meta = {
  title: "UI/SaveBar",
  component: SaveBar,
  parameters: { layout: "padded" },
  args: { draft: draft(), onSave: fn(async () => true), conflictBody: "lorebooks.entry.conflictBody" },
} satisfies Meta<typeof SaveBar>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Idle: Story = {};

export const Dirty: Story = {
  args: { draft: draft({ dirty: true, dirtyFields: ["name", "content"] }) },
};

export const Saving: Story = {
  args: { draft: draft({ dirty: true, dirtyFields: ["name"], saving: true }) },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole("status")).toHaveTextContent(t("lorebooks.record.saving"));
    await expect(canvas.getByRole("button", { name: t("lorebooks.record.saveChanges") })).toHaveAttribute(
      "aria-busy",
      "true",
    );
  },
};

const REASON = "engine returned 503";

export const Failed: Story = {
  args: { draft: draft({ dirty: true, dirtyFields: ["name"], error: REASON }) },
  play: async ({ canvasElement }) => {
    const status = within(canvasElement).getByRole("status");
    await expect(status).toHaveAttribute("aria-live", "polite");
    await expect(status).toHaveTextContent(t("lorebooks.record.saveFailed", { message: REASON }));
  },
};

export const Conflict: Story = {
  args: { draft: draft({ dirty: true, dirtyFields: ["name"], conflict: { theirs: BASE, fields: [] } }) },
  play: async ({ canvasElement }) => {
    const alert = within(canvasElement).getByRole("alert");
    await expect(alert).toHaveAccessibleName(t("lorebooks.record.conflictTitle"));
    await expect(alert).toHaveAccessibleDescription(t("lorebooks.entry.conflictBody", { detail: "" }));
  },
};

export const ConflictOnSameFields: Story = {
  args: {
    draft: draft({ dirty: true, dirtyFields: ["name", "content"], conflict: { theirs: BASE, fields: ["name"] } }),
    conflictBody: "presets.section.conflictBody",
  },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole("alert")).toHaveAccessibleName(t("lorebooks.record.conflictTitle"));
  },
};
