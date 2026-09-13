import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, within } from "storybook/test";
import { Field, Input, Select, Textarea } from "./Field";

const meta = {
  title: "UI/Field",
  component: Field,
  parameters: { layout: "centered" },
  decorators: [(Story) => <div style={{ width: 320 }}>{Story()}</div>],
  args: { label: "Display name", children: <Input defaultValue="Ada" /> },
} satisfies Meta<typeof Field>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const input = within(canvasElement).getByLabelText("Display name");
    await expect(input).not.toHaveAttribute("aria-describedby");
    await expect(input).not.toHaveAttribute("aria-invalid");
  },
};

export const WithHint: Story = {
  args: { hint: "Shown on every memory this character appears in." },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const input = canvas.getByLabelText("Display name");
    const hint = canvas.getByText("Shown on every memory this character appears in.");
    await expect(input.getAttribute("aria-describedby")).toBe(hint.id);
  },
};

export const WithError: Story = {
  args: {
    hint: "Shown on every memory this character appears in.",
    error: "Enter a name.",
    children: <Input defaultValue="" />,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const input = canvas.getByLabelText("Display name");
    const hint = canvas.getByText("Shown on every memory this character appears in.");
    const error = canvas.getByText("Enter a name.").closest("p");
    await expect(input).toHaveAttribute("aria-invalid", "true");
    await expect(input.getAttribute("aria-describedby")?.split(" ")).toEqual([hint.id, error?.id]);
  },
};

export const Required: Story = {
  args: { required: true },
  play: async ({ canvasElement }) => {
    const input = within(canvasElement).getByLabelText(/Display name/);
    await expect(input).toHaveAttribute("aria-required", "true");
  },
};

export const Optional: Story = { args: { optional: true } };

export const Disabled: Story = {
  args: {
    hint: "The engine owns this name while an import runs.",
    children: <Input defaultValue="Ada" disabled />,
  },
};

export const LabelHidden: Story = {
  args: { labelHidden: true, children: <Input placeholder="Add keyword" /> },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByLabelText("Display name")).toBeVisible();
  },
};

export const TextareaControl: Story = {
  args: {
    label: "Core",
    hint: "One line per fact.",
    children: <Textarea rows={4} defaultValue={"Prefers tea.\nLives in the observatory."} />,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const control = canvas.getByLabelText("Core");
    await expect(control.tagName).toBe("TEXTAREA");
    await expect(control.getAttribute("aria-describedby")).toBe(canvas.getByText("One line per fact.").id);
  },
};

export const SelectControl: Story = {
  args: {
    label: "Status",
    children: (
      <Select defaultValue="active">
        <option value="active">active</option>
        <option value="resolved">resolved</option>
        <option value="archived">archived</option>
      </Select>
    ),
  },
  play: async ({ canvasElement }) => {
    const control = within(canvasElement).getByLabelText("Status");
    await expect(control.tagName).toBe("SELECT");
  },
};
