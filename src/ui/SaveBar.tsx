import { joinList, t } from "../copy";
import type { Draft } from "../shell/draft";

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
  if (d.conflict) {
    return (
      <div className="savebar has-conflict" role="alertdialog">
        <p className="t-label">{t("lorebooks.record.conflictTitle")}</p>
        <p className="prose-note">
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
        <div className="savebar-acts">
          <button className="dbtn" onClick={d.takeTheirs}>
            {t("lorebooks.record.takeTheirs")}
          </button>
          <button className="dbtn is-primary" onClick={d.keepMine}>
            {t("lorebooks.record.keepMine")}
          </button>
        </div>
      </div>
    );
  }
  return (
    <div className={`savebar ${d.dirty ? "is-dirty" : ""}`}>
      <span className="savebar-state t-data">
        {d.saving ? (
          t("lorebooks.record.saving")
        ) : d.error ? (
          <span className="is-err">{d.error}</span>
        ) : d.dirty ? (
          t("lorebooks.record.unsavedChanges", { count: d.dirtyFields.length })
        ) : (
          t("lorebooks.record.noChanges")
        )}
      </span>
      <div className="savebar-acts">
        <button className="dbtn" disabled={!d.dirty || d.saving} onClick={d.cancel}>
          {t("lorebooks.record.cancel")}
        </button>
        <button className="dbtn is-primary" disabled={!d.dirty || d.saving} onClick={() => void props.onSave()}>
          {d.saving ? t("lorebooks.record.saving") : t("lorebooks.record.saveChanges")}
        </button>
      </div>
    </div>
  );
}
