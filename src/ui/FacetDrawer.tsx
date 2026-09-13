import type { ReactNode } from "react";
import { t } from "../copy";
import { closeTopOverlay } from "../shell/overlays";
import { Button } from "./Button";
import { cn, cva, type VariantProps } from "./cn";
import { Back, Confirm, ICON_SIZE } from "./icons";
import { Sheet, SheetHead } from "./Sheet";

/** A sheet holding multi-select facets that apply on each toggle. */

/** @public */
export interface FacetValue {
  value: string;
  label: string;
  /** Rows this value would keep, counted as if its own group applied no filter. */
  count: number;
  on: boolean;
  icon?: ReactNode;
}

export interface FacetGroupModel {
  id: string;
  label: string;
  values: FacetValue[];
}

export const facetSelected = (group: FacetGroupModel): number => group.values.filter((v) => v.on).length;

const COUNT = "ml-auto flex-none t-data text-label";

export function FacetDrawer(props: {
  /** The dialog's accessible name. */
  label: string;
  title: ReactNode;
  activeCount: number;
  onClear: () => void;
  /** Clears whatever renders the drawer, on scrim tap, Escape and back. */
  onClose: () => void;
  /** Present on a sub-screen, where the head leads with a way back and hides Clear. */
  back?: { label: string; onBack: () => void };
  /** The running result, shown beside Done. */
  result: ReactNode;
  children: ReactNode;
}) {
  // `filter-sheet` is the hook tests/e2e/overlays.spec.ts reaches the sheet by.
  return (
    <Sheet label={props.label} onClose={props.onClose} className="filter-sheet flex flex-col">
      <SheetHead
        title={<span className={"t-label t-label-s"}>{props.title}</span>}
        icon={
          props.back && (
            <Button
              variant="ghost"
              size="sm"
              icon={<Back size={ICON_SIZE.sm} stroke={1.75} aria-hidden />}
              className="text-accent hover:text-accent"
              onClick={props.back.onBack}
            >
              {props.back.label}
            </Button>
          )
        }
      >
        <span className={"ml-auto t-data text-label whitespace-nowrap text-dim"}>
          {props.activeCount ? t("ui.facets.activeCount", { count: props.activeCount }) : t("ui.facets.noneActive")}
        </span>
        {!props.back && props.activeCount > 0 && (
          <Button variant="ghost" size="sm" onClick={props.onClear}>
            {t("ui.facets.clear")}
          </Button>
        )}
      </SheetHead>
      <div className="min-h-0 flex-1 overflow-y-auto">{props.children}</div>
      <div className="flex items-center gap-2 border-t border-edge bg-canvas px-3 py-2">
        <span className={"flex-1 t-data text-data-s text-ink"}>{props.result}</span>
        <Button variant="secondary" size="sm" onClick={closeTopOverlay}>
          {t("ui.facets.done")}
        </Button>
      </div>
    </Sheet>
  );
}

const group = cva("min-w-0", {
  variants: { layout: { grid: "", list: "", tiles: "border-b border-edge" } },
});

const values = cva("clear-both", {
  variants: {
    layout: {
      grid: "grid grid-cols-2 [&>*]:border-r [&>*]:border-b [&>*]:border-edge",
      list: "[&>*]:border-b [&>*]:border-edge",
      tiles: "grid grid-cols-2 gap-1 px-3 pb-2",
    },
  },
});

type Layout = NonNullable<VariantProps<typeof values>["layout"]>;

/** One facet as a `fieldset`, with the tally of chosen values beside its name. */
export function FacetGroup(props: {
  group: FacetGroupModel;
  /** `grid` is two check rows across, `list` one, `tiles` a bordered grid without check marks. */
  layout?: Layout;
  /** Hidden when the group's name is already the drawer's title. */
  heading?: boolean;
  flag?: boolean;
  onToggle: (value: string) => void;
}) {
  const { group: model, layout = "grid", heading = true } = props;
  const selected = facetSelected(model);
  return (
    <fieldset className={cn(group({ layout }))}>
      {heading ? (
        <legend className="float-left flex w-full items-baseline gap-2 pt-2.5 pr-tap-2 pb-1 pl-3">
          <span className={"flex-1 t-label t-label-s text-ink"}>{model.label}</span>
          <FacetTally selected={selected} total={model.values.length} />
        </legend>
      ) : (
        <legend className="sr-only">{model.label}</legend>
      )}
      <div className={cn(values({ layout }))}>
        {model.values.map((v) => (
          <FacetToggle
            key={v.value}
            label={v.label}
            count={v.count}
            pressed={v.on}
            icon={v.icon}
            flag={props.flag}
            variant={layout === "tiles" ? "tile" : "row"}
            onToggle={() => props.onToggle(v.value)}
          />
        ))}
      </div>
    </fieldset>
  );
}

const tally = cva(COUNT, {
  variants: { chosen: { true: "text-accent", false: "text-dim" } },
});

/** A group's tally, `chosen/total` once anything is chosen and the total otherwise. */
export function FacetTally(props: { selected: number; total: number }) {
  return (
    <span className={cn(tally({ chosen: props.selected > 0 }))}>
      {props.selected ? `${props.selected}/${props.total}` : props.total}
    </span>
  );
}

const toggle = cva("flex items-center text-left", {
  variants: {
    variant: {
      row: "w-full min-w-0 gap-2 px-3 py-1.5",
      tile: "gap-1 rounded-sm border bg-canvas px-1.5 py-1",
    },
    state: { on: "", mixed: "", off: "" },
    dead: { true: "cursor-not-allowed opacity-45", false: "" },
    prominent: { true: "min-h-tap", false: "min-h-tap-2" },
  },
  compoundVariants: [
    { variant: "tile", state: "on", className: "border-accent" },
    { variant: "tile", state: ["mixed", "off"], className: "border-edge" },
    { variant: "row", state: "on", className: "bg-accent-wash" },
    { variant: "tile", state: ["mixed", "off"], dead: false, className: "hover:border-edge-strong" },
    { variant: "row", state: ["mixed", "off"], dead: false, className: "hover:bg-surface-2" },
  ],
});

const toggleLabel = cva("t-data wrap-anywhere", {
  variants: {
    variant: { row: "text-data-s leading-snug", tile: "text-label leading-tight" },
    state: { on: "text-ink", mixed: "text-ink", off: "text-dim" },
    summarised: { true: "flex-none", false: "min-w-0 flex-1" },
  },
});

type ToggleState = NonNullable<VariantProps<typeof toggle>["state"]>;

/** One value as a pressed-state button, reachable at zero so its count can still be read. */
export function FacetToggle(props: {
  label: ReactNode;
  count: number;
  pressed: boolean;
  /** Some of what this toggle stands for is chosen through another control. */
  partial?: boolean;
  flag?: boolean;
  icon?: ReactNode;
  /** Secondary text after the label. */
  summary?: ReactNode;
  variant?: "row" | "tile";
  /** A primary control at the tap floor. */
  prominent?: boolean;
  onToggle: () => void;
}) {
  const { variant = "row" } = props;
  const state: ToggleState = props.pressed ? "on" : props.partial ? "mixed" : "off";
  const dead = props.count === 0 && state === "off";
  return (
    <button
      type="button"
      className={cn(toggle({ variant, state, dead, prominent: props.prominent === true }))}
      aria-pressed={props.partial ? "mixed" : props.pressed}
      aria-disabled={dead || undefined}
      onClick={dead ? undefined : props.onToggle}
    >
      {variant === "row" && <FacetMark state={state} flag={props.flag} />}
      {props.icon}
      <span className={cn(toggleLabel({ variant, state, summarised: !!props.summary }))}>{props.label}</span>
      {props.summary && <span className={"min-w-0 flex-1 truncate t-data text-label text-dim"}>{props.summary}</span>}
      <span className={cn(COUNT, "text-dim")}>{props.count}</span>
    </button>
  );
}

const mark = cva(
  "inline-flex size-3.5 flex-none items-center justify-center rounded-[0.125rem] border text-accent-ink",
  {
    variants: {
      state: { on: "", mixed: "border-flag", off: "border-edge-strong" },
      flag: { true: "", false: "" },
    },
    compoundVariants: [
      { state: "on", flag: true, className: "border-flag bg-flag" },
      { state: "on", flag: false, className: "border-accent bg-accent" },
    ],
  },
);

function FacetMark(props: { state: ToggleState; flag?: boolean }) {
  return (
    <span className={cn(mark({ state: props.state, flag: props.flag === true }))} aria-hidden="true">
      {props.state === "mixed" ? (
        <span className="h-0.5 w-2 rounded-[0.125rem] bg-flag" />
      ) : props.state === "on" ? (
        <Confirm size={10} stroke={3} />
      ) : null}
    </span>
  );
}
