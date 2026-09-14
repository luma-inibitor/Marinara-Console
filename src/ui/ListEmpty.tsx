import { FirstRun, NoMatches, AllClear, Remove, Add, ICON_SIZE } from "./icons";
import { Button } from "./Button";
import { Chip } from "./Chip";
import { EmptyState } from "./EmptyState";
import { t, type Key } from "../copy";

/** A list with nothing in it, rendered by the reason it is empty.
 *
 *  Empty has three causes and they need three different sentences: first-run
 *  copy over a filtered list tells a reader with forty-seven entries that they
 *  have none. A named composition of `EmptyState`, like `ErrorState` and
 *  `NotFound`. The filtered case is the only empty state that offers a way out
 *  of itself, by naming the filters responsible.
 *
 *  `what` is the copy key of the subject. */
export function ListEmpty(props: {
  kind: "first-run" | "filtered" | "cleared";
  what: Key;
  /** Active filters, for the diagnostic treatment. */
  filters?: Array<{ label: string; clear: () => void }>;
  onClearAll?: () => void;
  action?: { label: string; run: () => void };
}) {
  const what = t(props.what);

  if (props.kind === "filtered") {
    return (
      <EmptyState
        icon={<NoMatches size={22} stroke={1.75} aria-hidden />}
        title={t("ui.list.filteredTitle", { what })}
        body={props.filters?.length ? t("ui.list.filteredBody") : undefined}
        actions={
          <>
            {props.filters?.map((f) => (
              <Chip key={f.label} onClick={f.clear}>
                {f.label}
                <Remove size={ICON_SIZE.sm} stroke={2} aria-hidden />
              </Chip>
            ))}
            {props.onClearAll && <Button onClick={props.onClearAll}>{t("ui.list.clearFilters")}</Button>}
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
        body={t("ui.list.clearedBody", { what })}
      />
    );
  }

  return (
    <EmptyState
      icon={<FirstRun size={22} stroke={1.75} aria-hidden />}
      title={t("ui.list.firstRunTitle", { what })}
      body={t("ui.list.firstRunBody", { what })}
      actions={
        props.action && (
          <Button
            variant="primary"
            icon={<Add size={ICON_SIZE.md} stroke={1.75} aria-hidden />}
            onClick={props.action.run}
          >
            {props.action.label}
          </Button>
        )
      }
    />
  );
}
