import { useState } from "react";
import { t } from "../copy";
import { Button } from "./Button";
import { cn } from "./cn";
import { ICON_SIZE, Remove } from "./icons";

const INPUT =
  "min-h-tap-2 min-w-32 flex-1 rounded-md border border-edge-control bg-canvas px-2.5 " +
  "t-data text-data text-ink placeholder:text-dim focus-visible:border-accent focus-visible:outline-none";

/** Values as removable chips with an inline field; a paste splits on commas and newlines. */
export function ChipEditor(props: {
  values: string[];
  onChange: (values: string[]) => void;
  /** Names the list, as in "Primary Keys". */
  label: string;
  placeholder: string;
  /** Values to mark, such as the keys a test text matched. */
  highlight?: readonly string[];
}) {
  const [draft, setDraft] = useState("");
  const commit = () => {
    const added = draft
      .split(/[,\n]/)
      .map((x) => x.trim())
      .filter(Boolean);
    if (added.length) props.onChange([...props.values, ...added]);
    setDraft("");
  };
  return (
    <div className="flex flex-wrap items-center gap-2">
      {props.values.map((v, i) => (
        <span
          key={`${v}:${i}`}
          className={cn(
            "inline-flex min-h-tap-2 max-w-full items-center rounded-md border border-edge bg-surface-1 pl-2.5 t-data text-data text-ink",
            props.highlight?.includes(v) && "border-warn bg-warn-wash",
          )}
        >
          <span className="truncate">{v}</span>
          <Button
            variant="ghost"
            size="sm"
            iconOnly
            label={t("pill.removeValue1", { value1: v })}
            icon={<Remove size={ICON_SIZE.xs} stroke={2} aria-hidden />}
            onClick={() => props.onChange(props.values.filter((_, j) => j !== i))}
          />
        </span>
      ))}
      <input
        className={INPUT}
        value={draft}
        placeholder={props.placeholder}
        aria-label={props.label}
        onInput={(ev) => setDraft(ev.currentTarget.value)}
        onKeyDown={(ev) => {
          if (ev.key === "Enter") {
            ev.preventDefault();
            commit();
          } else if (ev.key === "Escape" && draft) {
            ev.preventDefault();
            setDraft("");
          }
        }}
        onBlur={commit}
      />
    </div>
  );
}
