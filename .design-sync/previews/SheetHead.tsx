import type { ReactNode } from "react";
import { Chip, SheetHead, Tag, TYPE_ICON, ICON_SIZE } from "marinara-console";

// The real type glyph, not a hand-drawn stand-in: TYPE_ICON is the console's
// own one-icon-per-type map, so a card that draws its own would teach the
// wrong glyph (design/CHECKLIST.md §4).
const Character = TYPE_ICON.character;

/** The head is written to sit at the top edge of a sheet body — it pulls itself
 *  out to the panel's padding with negative margins. This stands in for that
 *  body so the rule lands where it was designed to. */
function Panel(props: { children: ReactNode }) {
  return (
    <div style={{ width: "100%", padding: "var(--s3)", background: "var(--surface-1)",
                  border: "var(--hairline)", borderRadius: "var(--r-l)",
                  overflow: "hidden" }}>
      {props.children}
    </div>
  );
}

export function Titled() {
  return (
    <Panel>
      <SheetHead icon={<Character size={ICON_SIZE.md} stroke={1.75} aria-hidden />} title="Devi Okonkwo" />
      <p className="t-prose" style={{ margin: 0, color: "var(--text-dim)" }}>
        Harbour clerk who keeps the writ ledger.
      </p>
    </Panel>
  );
}

export function Controls() {
  return (
    <Panel>
      <SheetHead title={<span className="t-label t-label-s">Filters</span>}>
        <Chip>Clear</Chip>
      </SheetHead>
      <div style={{ display: "flex", gap: "var(--s2)", flexWrap: "wrap" }}>
        <Tag>character</Tag>
        <Tag>thread</Tag>
        <Tag>timeline event</Tag>
      </div>
    </Panel>
  );
}

export function Wrapping() {
  return (
    <Panel>
      <SheetHead
        icon={<Character size={ICON_SIZE.md} stroke={1.75} aria-hidden />}
        title="The writ of passage Devi withheld from the harbour ledger"
      />
      <div className="t-data" style={{ color: "var(--text-dim)" }}>
        source_character_c7a1843d96ae1092
      </div>
    </Panel>
  );
}
