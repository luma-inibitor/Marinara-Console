import { cva } from "./cn";
import { MODE_ICON } from "./icons";
import { t, joinList } from "../copy";

export const MODES = [
  { id: "conversation", short: "DM", name: t("ui.mode.conversation"), Icon: MODE_ICON.conversation },
  { id: "roleplay", short: "RP", name: t("ui.mode.roleplay"), Icon: MODE_ICON.roleplay },
  { id: "game", short: "GM", name: t("ui.mode.game"), Icon: MODE_ICON.game },
] as const;

const PILL = "inline-flex flex-none rounded-sm border border-edge";

const seg = cva(
  "inline-flex items-center justify-center gap-[5px] border-r border-edge first:rounded-l-sm last:rounded-r-sm last:border-r-0",
  {
    variants: {
      part: { readout: "px-2 py-[2px]", toggle: "hit min-h-tap min-w-[58px] px-2 focus-visible:z-[1]" },
      lit: { true: "bg-surface-3 text-ink", false: "text-dim" },
    },
    compoundVariants: [
      { part: "toggle", lit: false, className: "focus-visible:shadow-[var(--focus-ring)]" },
      {
        part: "toggle",
        lit: true,
        className:
          "shadow-[inset_0_-2px_0_var(--accent)] focus-visible:shadow-[var(--focus-ring),inset_0_-2px_0_var(--accent)]",
      },
    ],
  },
);

/** The three chat modes as a segmented pill; `onToggle` makes each segment a toggle. */
export function ModePill(props: {
  /** Mode ids that are lit. */
  modes: string[] | Set<string>;
  /** Present makes the pill interactive. */
  onToggle?: (id: string) => void;
  label?: string;
}) {
  const on = (id: string) => (Array.isArray(props.modes) ? props.modes.includes(id) : props.modes.has(id));

  if (!props.onToggle) {
    const lit = MODES.filter((m) => on(m.id)).map((m) => m.name);
    return (
      <span
        className={PILL}
        role="img"
        aria-label={t("ui.mode.readout", { list: lit.length ? joinList(lit) : t("ui.mode.none") })}
      >
        {MODES.map((m) => (
          <span key={m.id} className={seg({ part: "readout", lit: on(m.id) })} title={m.name}>
            <m.Icon size={13} stroke={1.75} aria-hidden />
            <span className="t-data">{m.short}</span>
          </span>
        ))}
      </span>
    );
  }

  return (
    <div className={PILL} role="group" aria-label={props.label ?? t("ui.mode.filterLabel")}>
      {MODES.map((m) => (
        <button
          key={m.id}
          type="button"
          className={seg({ part: "toggle", lit: on(m.id) })}
          aria-pressed={on(m.id)}
          aria-label={`${m.short} — ${m.name}`}
          onClick={() => props.onToggle!(m.id)}
        >
          <m.Icon size={13} stroke={1.75} aria-hidden />
          <span className="t-data">{m.short}</span>
        </button>
      ))}
    </div>
  );
}
