import { Chip, Remove, ICON_SIZE } from "marinara-console";

const row = { display: "flex", flexWrap: "wrap" as const, gap: "var(--s2)", alignItems: "center" };

/** Plain actions. Accent means interactive, so a chip is always pressable —
 *  a label that is not gets `<Tag>` instead. */
export function Actions() {
  return (
    <div style={row}>
      <Chip onClick={() => {}}>Clear filters</Chip>
      <Chip onClick={() => {}}>Add keyword</Chip>
      <Chip onClick={() => {}}>Re-extract</Chip>
    </div>
  );
}

/** `pressed` makes it a toggle and renders the pressed state. */
export function Toggles() {
  return (
    <div style={row}>
      <Chip pressed onClick={() => {}}>character</Chip>
      <Chip onClick={() => {}}>relationship</Chip>
      <Chip pressed onClick={() => {}}>thread</Chip>
      <Chip onClick={() => {}}>world</Chip>
      <Chip onClick={() => {}}>tone</Chip>
    </div>
  );
}

/** `flag` is the computed-outlier hue, reserved for flag filters. */
export function Flags() {
  return (
    <div style={row}>
      <Chip flag pressed onClick={() => {}}>over cap</Chip>
      <Chip flag onClick={() => {}}>no evidence</Chip>
      <Chip flag onClick={() => {}}>duplicate key</Chip>
    </div>
  );
}

/** A removable filter carries the dismiss glyph as a child, and a chip with
 *  nothing left to do is disabled rather than hidden. */
export function Dismissible() {
  return (
    <div style={row}>
      <Chip onClick={() => {}}>type: character<Remove size={ICON_SIZE.sm} stroke={2} aria-hidden /></Chip>
      <Chip onClick={() => {}}>§voice<Remove size={ICON_SIZE.sm} stroke={2} aria-hidden /></Chip>
      <Chip disabled>no filters</Chip>
    </div>
  );
}
