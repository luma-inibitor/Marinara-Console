import { FirstRun, NoMatches, AllClear, Remove, Add, ICON_SIZE } from "./icons";
import { Chip } from "./Chip";
import { EmptyState } from "./EmptyState";
import { t } from "../copy";

/** A list with nothing in it, rendered by the reason it is empty.
 *
 *  Empty has three causes and they need three different sentences. The UX
 *  review found first-run copy standing in for filtered-empty, which tells a
 *  reader with forty-seven entries that they have none, and offers them a
 *  "create your first" button for a list that is already full.
 *
 *  A named composition of `EmptyState`, like `ErrorState` and `NotFound`: the
 *  primitive still takes any icon, title and body, and this fixes the three
 *  the console actually has. The filtered case is the reason this exists as a
 *  component rather than a copy table — it is the only empty state that can
 *  offer a way out of itself, by naming the filters responsible and letting
 *  the reader drop them one at a time. */
export function ListEmpty(props: {
  kind: "first-run" | "filtered" | "cleared";
  what: string;
  /** Active filters, for the diagnostic treatment. */
  filters?: Array<{ label: string; clear: () => void }>;
  onClearAll?: () => void;
  action?: { label: string; run: () => void };
}) {
  if (props.kind === "filtered") {
    return (
      <EmptyState
        icon={<NoMatches size={22} stroke={1.75} aria-hidden />}
        title={t("ui.list.filteredTitle", { what: props.what })}
        body={props.filters?.length ? t("ui.list.filteredBody") : undefined}
        actions={
          <>
            {props.filters?.map((f) => (
              <Chip key={f.label} onClick={f.clear}>{f.label}<Remove size={ICON_SIZE.sm} stroke={2} aria-hidden /></Chip>
            ))}
            {props.onClearAll && <button className="dbtn" onClick={props.onClearAll}>{t("ui.list.clearFilters")}</button>}
          </>
        }
      />
    );
  }

  if (props.kind === "cleared") {
    return (
      <EmptyState
        tone="ok"
        icon={<AllClear size={22} stroke={1.75} aria-hidden />}
        title={t("ui.list.clearedTitle")}
        body={t("ui.list.clearedBody", { what: props.what })}
      />
    );
  }

  return (
    <EmptyState
      icon={<FirstRun size={22} stroke={1.75} aria-hidden />}
      title={t("ui.list.firstRunTitle", { what: props.what })}
      body={t("ui.list.firstRunBody", { what: props.what })}
      actions={props.action && (
        <button className="dbtn is-primary" onClick={props.action.run}>
          {/* First-run's only action is "make the first one", so the glyph is
              fixed here rather than smuggled into each caller's label string. */}
          <Add size={ICON_SIZE.md} stroke={1.75} aria-hidden />{props.action.label}
        </button>
      )}
    />
  );
}
