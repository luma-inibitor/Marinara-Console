import { t } from "../../../copy";
import type { NoteSection } from "../api/types";
import { LinkTarget } from "../components/NoteRef";
import { Button, Meter, SectionKey } from "../../../ui";
import { ChevronRight, Flag, ICON_SIZE } from "../../../ui/icons";
import { cn, cva } from "../../../ui/cn";
import { After, DL, Pair, TARGET, TARGET_LINK, Word, groundBg, raisedHover, type Ground } from "./chrome";
import { dimensionRows, editStamp, evidenceRef, percentOf, sectionMeta, signed, type SectionView } from "./model";

const SUB = "m-0 t-label t-label-s mt-1";

const delta = cva("", { variants: { trend: { up: "text-ok", down: "text-danger", flat: "text-dim" } } });

function Score({ value }: { value: number }) {
  const pct = percentOf(value);
  return (
    <span className="flex items-center gap-2">
      <Meter max={100} value={pct} className="w-20" />
      <span className="tabular-nums">{pct}%</span>
    </span>
  );
}

function Contribution({ c }: { c: NonNullable<NoteSection["contributions"]>[number] }) {
  const stamp = editStamp(c.updatedAt);
  return (
    <li className="flex min-w-0 flex-wrap items-center gap-x-[6px] gap-y-1">
      <span>{c.owner}</span>
      {c.sourceNoteId && (
        <After>
          <LinkTarget id={c.sourceNoteId} className={TARGET} linkClassName={TARGET_LINK} />
        </After>
      )}
      {stamp && (
        <After>
          <span className="text-dim">{stamp}</span>
        </After>
      )}
      {c.confidence != null && (
        <After>
          <span className="text-dim tabular-nums">{percentOf(c.confidence)}%</span>
        </After>
      )}
    </li>
  );
}

function Evidence({ entry }: { entry: string }) {
  const ref = evidenceRef(entry);
  if (!ref) return <li className="border-l-2 border-edge-strong pl-2 font-prose text-data leading-snug">{entry}</li>;
  return (
    <li className="flex min-w-0 items-center gap-x-[6px] font-data text-data-s">
      <span className="shrink-0 text-dim">{ref.kind}</span>
      {ref.kind === "source_note" ? (
        <LinkTarget id={ref.id} className={TARGET} linkClassName={TARGET_LINK} />
      ) : (
        <span className="[overflow-wrap:anywhere]">{ref.id}</span>
      )}
    </li>
  );
}

function SectionBody({ view }: { view: SectionView }) {
  const s = view.section;
  const updated = editStamp(s.updatedAt);
  const evidence = s.evidence ?? [];
  const contributions = s.contributions ?? [];
  const dimensions = dimensionRows(s.dimensions, s.dimensionChanges);
  return (
    <div className="mb-3 ml-6 flex max-w-[var(--measure)] flex-col gap-2">
      <ul className="m-0 flex list-disc flex-col gap-[7px] pl-4 font-prose text-prose leading-normal marker:text-faint">
        {view.lines.map((line, i) => (
          <li key={i}>{line}</li>
        ))}
      </ul>

      {(s.importance != null || s.confidence != null || s.salience != null || updated) && (
        <dl className={DL}>
          {s.importance != null && <Pair k={<Word>{t("memoryvault.importance")}</Word>}>{s.importance}</Pair>}
          {s.confidence != null && (
            <Pair k={<Word>{t("memoryvault.confidence")}</Word>}>
              <Score value={s.confidence} />
            </Pair>
          )}
          {s.salience != null && (
            <Pair k={<Word>{t("memoryvault.salience")}</Word>}>
              <Score value={s.salience} />
            </Pair>
          )}
          {updated && <Pair k={<Word>{t("memoryvault.updated")}</Word>}>{updated}</Pair>}
        </dl>
      )}

      {evidence.length > 0 && (
        <>
          <h4 className={SUB}>{t("memoryvault.evidence")}</h4>
          <ul className="m-0 flex list-none flex-col gap-1 p-0 text-dim">
            {evidence.map((entry, i) => (
              <Evidence key={i} entry={entry} />
            ))}
          </ul>
        </>
      )}

      {contributions.length > 0 && (
        <>
          <h4 className={SUB}>{t("memory.detail.contributions")}</h4>
          <ul className="m-0 flex list-none flex-col gap-1 p-0 font-data text-data-s">
            {contributions.map((c, i) => (
              <Contribution key={i} c={c} />
            ))}
          </ul>
        </>
      )}

      {dimensions.length > 0 && (
        <>
          <h4 className={SUB}>{t("memory.detail.dimensions")}</h4>
          <dl className={DL}>
            {dimensions.map((row) => (
              <Pair key={row.axis} k={row.axis}>
                <span className="flex items-center gap-2 tabular-nums">
                  {row.value != null && (
                    <>
                      <Meter max={100} value={row.value} className="w-20" />
                      <span>{row.value}</span>
                    </>
                  )}
                  {row.delta != null && (
                    <span className={delta({ trend: row.delta > 0 ? "up" : row.delta < 0 ? "down" : "flat" })}>
                      {signed(row.delta)}
                    </span>
                  )}
                </span>
              </Pair>
            ))}
          </dl>
        </>
      )}
    </div>
  );
}

/** One section as one row. */
export function SectionRow(props: {
  view: SectionView;
  open: boolean;
  flagOpen: boolean;
  onToggle: () => void;
  onFlag: () => void;
  ground?: Ground;
  /** The card head's height. */
  stickyTop?: number;
}) {
  const { view, open, ground = "canvas", stickyTop = 0 } = props;
  const importance = view.section.importance;

  return (
    <div data-section={view.key} className="border-b border-edge">
      <div
        className={cn("flex items-center gap-2", open && ["sticky z-[3] border-b border-edge", groundBg({ ground })])}
        style={open ? { top: stickyTop } : undefined}
      >
        <h3 className="m-0 flex min-w-0 flex-1">
          <Button
            variant="ghost"
            labelCase="sentence"
            fullWidth
            iconAlign="end"
            className={cn(
              "grid min-w-0 grid-cols-[minmax(0,1fr)_auto] px-0 text-left font-normal",
              raisedHover({ ground }),
            )}
            expanded={open}
            onClick={props.onToggle}
            icon={
              <span
                className={cn(
                  "flex text-faint transition-transform [transition-duration:var(--t-fast)]",
                  open && "rotate-90",
                )}
                aria-hidden
              >
                <ChevronRight size={ICON_SIZE.md} />
              </span>
            }
          >
            <span className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
              <span className="inline-flex min-w-0 flex-wrap items-center gap-x-[6px]">
                <SectionKey k={view.key} className="[overflow-wrap:anywhere]" />
                {importance != null && <span className="font-data text-data-s text-dim">{importance}</span>}
              </span>
              <span className="t-num text-label whitespace-nowrap text-dim [font-variant-ligatures:none]">
                {sectionMeta(view)}
              </span>
            </span>
          </Button>
        </h3>
        {view.flag && (
          <Button
            iconOnly
            variant="ghost"
            size="sm"
            className="shrink-0"
            label={t("memory.detail.flagWhy")}
            expanded={props.flagOpen}
            onClick={props.onFlag}
            icon={<Flag className="text-flag" size={ICON_SIZE.sm} stroke={2} aria-hidden />}
          />
        )}
      </div>
      {view.flag && props.flagOpen && (
        <p className="m-0 mb-2 ml-6 max-w-[var(--measure)] font-prose text-data leading-snug">{view.flag.sentence}</p>
      )}
      {open && <SectionBody view={view} />}
    </div>
  );
}
