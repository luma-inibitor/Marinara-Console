import { JsonView } from "./JsonView";
import { t } from "../copy";

/** The underlying record, folded away and labeled with how many lines it hides. */
export function RawJson(props: { value: unknown; label?: string }) {
  const lines = JSON.stringify(props.value, null, 2).split("\n").length;
  const label = props.label ?? t("ui.rawjson.label");
  return (
    <details className="group mt-3 border-t border-edge pt-2">
      <summary className="flex min-h-[28px] cursor-pointer list-none items-center gap-2 font-label text-label-s font-semibold tracking-[0.12em] text-dim uppercase [font-variation-settings:'wdth'_110] before:text-[10px] before:transition-transform before:[transition-duration:var(--t-fast)] before:content-['▸'] group-open:before:rotate-90 hover:text-ink [&::-webkit-details-marker]:hidden">
        {label}
        <span className="ml-auto t-data tracking-normal text-dim normal-case">
          {t("ui.rawjson.lines", { count: lines })}
        </span>
      </summary>
      <JsonView value={props.value} label={label} />
    </details>
  );
}
