import { MODE_ICON } from "./icons";
import { t, joinList } from "../copy";
import "./ModePill.css";

/** The three chat modes as a segmented pill. Every segment always renders, so
 *  the pill's width never changes and a column of them stays skimmable.
 *
 *  Pass `onToggle` and each segment becomes an independent toggle — all three
 *  lit means no filter. Leave it off and the pill is a read-out.
 *
 *  One component because there were two, and they had drifted: the read-out in
 *  the note peek had no icons and lit its active segments with the accent wash,
 *  while accent is reserved for interactive (DESIGN.md §2). A read-out cannot
 *  be interactive, so it cannot reach for that hue. Both now light with a
 *  raised surface, and only the interactive one adds the accent border that
 *  Chip's toggles already use. */
export const MODES = [
  { id: "conversation", short: "DM", name: t("ui.mode.conversation"), Icon: MODE_ICON.conversation },
  { id: "roleplay", short: "RP", name: t("ui.mode.roleplay"), Icon: MODE_ICON.roleplay },
  { id: "game", short: "GM", name: t("ui.mode.game"), Icon: MODE_ICON.game },
] as const;

export function ModePill(props: {
  /** Mode ids that are lit. */
  modes: string[] | Set<string>;
  /** Present makes the pill interactive. */
  onToggle?: (id: string) => void;
  label?: string;
}) {
  const on = (id: string) =>
    Array.isArray(props.modes) ? props.modes.includes(id) : props.modes.has(id);

  if (!props.onToggle) {
    const lit = MODES.filter((m) => on(m.id)).map((m) => m.name);
    return (
      <span className="modepill" role="img" aria-label={t("ui.mode.readout", { list: lit.length ? joinList(lit) : t("ui.mode.none") })}>
        {MODES.map((m) => (
          <span key={m.id} className={`mseg ${on(m.id) ? "is-on" : ""}`} title={m.name}>
            <m.Icon size={13} stroke={1.75} aria-hidden />
            <span className="t-data">{m.short}</span>
          </span>
        ))}
      </span>
    );
  }

  return (
    <div className="modepill is-interactive" role="group" aria-label={props.label ?? t("ui.mode.filterLabel")}>
      {MODES.map((m) => (
        <button
          key={m.id}
          type="button"
          className="mseg hit"
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
