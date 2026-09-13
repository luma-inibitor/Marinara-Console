import { useEffect, useId } from "react";
import { Button } from "./Button";
import { cn, cva } from "./cn";
import { Failure, ICON_SIZE } from "./icons";
import { toast } from "../shell/toast";
import { joinList, t } from "../copy";
import type { Draft } from "../shell/draft";

const bar = cva(
  [
    "sticky bottom-0 z-12 mt-3 items-center justify-between gap-3 rounded-md border px-3 py-2",
    "bg-[color-mix(in_srgb,var(--surface-1)_92%,transparent)] backdrop-blur-[10px]",
  ],
  {
    variants: {
      state: {
        clean: "flex border-edge max-split:flex-wrap",
        dirty: "flex border-[color-mix(in_srgb,var(--accent)_45%,transparent)] max-split:flex-wrap",
        conflict: "block border-[color-mix(in_srgb,var(--warn)_55%,transparent)] bg-warn-wash",
      },
    },
  },
);

const ACTS = "flex shrink-0 gap-2 max-split:w-full";
const ACT = "max-split:flex-1";

/** The sticky commit bar over an explicit-save draft: change count on the left,
 *  Cancel and Save on the right, conflict resolution in place of both when the
 *  record moved mid-edit. `conflictBody` is the copy key of that sentence. */
export function SaveBar<T extends { id: string }>(props: {
  draft: Draft<T>;
  onSave: () => Promise<boolean>;
  /** The conflict sentence, per record kind. */
  conflictBody: "lorebooks.entry.conflictBody" | "presets.section.conflictBody";
}) {
  const d = props.draft;
  const titleId = useId();
  const bodyId = useId();
  const error = d.error && t("lorebooks.record.saveFailed", { message: d.error });
  useEffect(() => {
    if (error) toast(error, { kind: "error" });
  }, [error]);
  if (d.conflict) {
    return (
      <div className={bar({ state: "conflict" })} role="alert" aria-labelledby={titleId} aria-describedby={bodyId}>
        <p id={titleId} className="m-0 t-label text-warn">
          {t("lorebooks.record.conflictTitle")}
        </p>
        <p id={bodyId} className="m-0 font-prose text-prose leading-[1.5] text-dim">
          {t(props.conflictBody, {
            detail:
              d.conflict.fields.length > 0
                ? t("lorebooks.record.conflictFields", {
                    count: d.conflict.fields.length,
                    list: joinList(d.conflict.fields),
                  })
                : "",
          })}
        </p>
        <div className={cn(ACTS, "mt-2 justify-end")}>
          <Button className={ACT} onClick={d.takeTheirs}>
            {t("lorebooks.record.takeTheirs")}
          </Button>
          <Button className={ACT} variant="primary" onClick={d.keepMine}>
            {t("lorebooks.record.keepMine")}
          </Button>
        </div>
      </div>
    );
  }
  return (
    <div className={bar({ state: d.dirty ? "dirty" : "clean" })}>
      <span className="t-data text-dim" role="status" aria-live="polite">
        {d.saving ? (
          t("lorebooks.record.saving")
        ) : error ? (
          <span className="inline-flex items-center gap-1 text-danger">
            <Failure size={ICON_SIZE.sm} stroke={2} aria-hidden />
            <span>{error}</span>
          </span>
        ) : d.dirty ? (
          t("lorebooks.record.unsavedChanges", { count: d.dirtyFields.length })
        ) : (
          t("lorebooks.record.noChanges")
        )}
      </span>
      <div className={ACTS}>
        <Button className={ACT} disabled={!d.dirty || d.saving} onClick={d.cancel}>
          {t("lorebooks.record.cancel")}
        </Button>
        <Button
          className={ACT}
          variant="primary"
          disabled={!d.dirty}
          pending={d.saving}
          onClick={() => void props.onSave()}
        >
          {t("lorebooks.record.saveChanges")}
        </Button>
      </div>
    </div>
  );
}
