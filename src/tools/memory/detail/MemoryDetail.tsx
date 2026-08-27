// The memory detail card — a read-only screen for one stored memory.
//
// Two jobs, in this order: let a reader read what the memory says, and let
// them predict whether it will fire in a chat. Everything on the screen serves
// one of those, which is why there is no decide bar, no archive, and no
// editing beyond the one control that leaves for the editor.
//
// The screen's load-bearing rule is that the RETRIEVAL BLOCK is the only
// bordered surface: boxed means metadata, unboxed means content. A second card
// anywhere — especially around a section body — collapses that distinction and
// was the single biggest failure of the directions that lost.
//
// Every section expands in place, however long it is. A long one is made
// navigable by its own row sticking under the head while you read it, so there
// is one interaction to learn and one thing the chevron can mean.
//
// All state here is view-local. Nothing is persisted and nothing is fetched:
// the note arrives as a prop.

import { useLayoutEffect, useRef, useState } from "react";
import type { Note } from "../api/types";
import { t } from "../../../copy";
import { TypeIcon } from "../icons";
import { Back, Close, Edit, ExpandSet, ICON_SIZE } from "../../../ui/icons";
import { Button, Chip, CopyableText, RawJson } from "../../../ui";
import { StatusPill } from "../components/StatusPill";
import { RetrievalCard } from "./RetrievalCard";
import { SectionRow } from "./SectionRow";
import { editStamp, sectionViews } from "./model";
import "./MemoryDetail.css";

/** Past this many sections the card opens collapsed. Collapse-all is the
 *  manifest state — every section becomes a bare row — so a long memory needs
 *  no separate overflow design, only a different starting point. */
const COLLAPSE_PAST = 6;

export function MemoryDetail(props: {
  note: Note;
  onBack: () => void;
  /** Omitted where the screen has nowhere to send an editor. */
  onEdit?: () => void;
  defaultCollapsed?: boolean;
  /** The overlay projection: the card dismisses instead of going back, takes
   *  focus on open, and carries the stored record as a fold. */
  peek?: boolean;
}) {
  const n = props.note;
  const views = sectionViews(n);

  // The collapse-all baseline, and the per-section overrides laid over it.
  // Effective open = override ?? baseline, so toggling the baseline has to
  // clear the overrides or a row would keep answering to a stale decision.
  const [allOpen, setAllOpen] = useState(!(props.defaultCollapsed ?? views.length > COLLAPSE_PAST));
  const [openBySection, setOpenBySection] = useState<Record<string, boolean>>({});
  const [flagKey, setFlagKey] = useState<string | null>(null);

  const scroller = useRef<HTMLDivElement>(null);
  const head = useRef<HTMLElement>(null);
  const [headH, setHeadH] = useState(0);

  // An open row parks under the head, so it has to know how tall the head is —
  // and that changes with the title's wrap and the meta line's. Observed rather
  // than assumed: a guessed offset leaves a gap or hides the row behind it.
  useLayoutEffect(() => {
    const el = head.current;
    if (!el) return;
    const measure = () => setHeadH(el.getBoundingClientRect().height);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Collapsing a section you have scrolled deep into removes everything you
  // were standing on, and the scroll position lands wherever the shortened
  // document puts it. Anchor back to the row instead — without this, the
  // sticky control creates the disorientation it exists to prevent.
  const anchorTo = useRef<string | null>(null);
  useLayoutEffect(() => {
    const key = anchorTo.current;
    if (!key) return;
    anchorTo.current = null;
    const box = scroller.current;
    const row = box?.querySelector<HTMLElement>(`.mdc-row-wrap[data-key="${CSS.escape(key)}"]`);
    if (!box || !row) return;
    const above = row.getBoundingClientRect().top - (box.getBoundingClientRect().top + headH);
    if (above < 0) box.scrollTop += above;
  });

  const isOpen = (key: string) => openBySection[key] ?? allOpen;
  const toggleSection = (key: string) => {
    if (isOpen(key)) anchorTo.current = key; // closing: keep the row in view
    setOpenBySection((prev) => ({ ...prev, [key]: !isOpen(key) }));
  };
  const toggleAll = () => {
    // Closing everything at once has no single row to anchor to, so the list's
    // own head is the destination.
    if (allOpen) anchorTo.current = views[0]?.key ?? null;
    setAllOpen((was) => !was);
    setOpenBySection({});
  };

  const chars = views.reduce((sum, v) => sum + v.chars, 0);
  const edited = editStamp(n.updatedAt);

  return (
    <div className="mdc" ref={scroller} style={{ "--mdc-head-h": `${headH}px` } as React.CSSProperties}>
      <header className="console mdc-head" ref={head}>
        <div className="hrow">
          <Button
            iconOnly
            variant="ghost"
            className="mdc-back"
            autoFocus={props.peek}
            label={props.peek ? t("ui.sheet.close") : t("memory.backToVault")}
            onClick={props.onBack}
            icon={
              props.peek ? (
                <Close size={ICON_SIZE.xl} stroke={1.75} aria-hidden />
              ) : (
                <Back size={ICON_SIZE.xl} stroke={1.75} aria-hidden />
              )
            }
          />
          <TypeIcon type={n.type} size={ICON_SIZE.lg} />
          {/* Titles wrap and never truncate: the title is the last thing on
              the screen that may be cut. */}
          <h1 className="mdc-title">{n.title ?? n.id}</h1>
          {props.onEdit && (
            <Chip className="mdc-edit" onClick={props.onEdit}>
              <Edit size={ICON_SIZE.sm} stroke={1.75} aria-hidden />
              {t("memory.detail.edit")}
            </Chip>
          )}
        </div>
        <div className="mdc-meta t-data">
          <span className={`mdc-type type-${n.type}`}>{n.type.replaceAll("_", " ")}</span>
          {edited && (
            <>
              <i className="mdc-sep" data-contrast-exempt>
                ·
              </i>
              <span>{t("memory.detail.edited", { when: edited })}</span>
            </>
          )}
          {n.version != null && (
            <>
              <i className="mdc-sep" data-contrast-exempt>
                ·
              </i>
              <span>{t("memory.detail.version", { n: n.version })}</span>
            </>
          )}
          <StatusPill status={n.status} className="mdc-status" />
        </div>
      </header>

      <div className="mdc-body">
        <RetrievalCard note={n} />

        <div className="mdc-sechead">
          <span className="t-label t-label-s">{t("ui.sections")}</span>
          {/* The label beside it already says "sections", so the count is a
              bare figure here; the spoken name carries the noun. */}
          <span className="mdc-sectally t-num" aria-label={t("memory.detail.sectionCount", { count: views.length })}>
            {views.length}
            <i className="mdc-sep" data-contrast-exempt>
              ·
            </i>
            {chars.toLocaleString()} {t("ui.editor.charUnit")}
          </span>
          <button type="button" className="mdc-all t-label t-label-s" aria-pressed={allOpen} onClick={toggleAll}>
            <span className={`mdc-allglyph ${allOpen ? "is-open" : ""}`}>
              <ExpandSet size={ICON_SIZE.sm} stroke={1.75} aria-hidden />
            </span>
            {allOpen ? t("memory.detail.collapseAll") : t("memory.detail.expandAll")}
          </button>
        </div>

        {views.map((view) => (
          <SectionRow
            key={view.key}
            view={view}
            open={isOpen(view.key)}
            flagOpen={flagKey === view.key}
            onToggle={() => toggleSection(view.key)}
            onFlag={() => setFlagKey((was) => (was === view.key ? null : view.key))}
          />
        ))}

        {/* The record. Provenance lives in the retrieval block, so the id is
            all that is left down here — and it is the one element with no
            settled home, which is why it stays isolated. */}
        <div className="mdc-record t-data">
          <CopyableText value={n.id} label={t("memory.peek.id")} />
        </div>

        {props.peek && <RawJson value={n} label={t("memory.peek.rawMemory")} />}
      </div>
    </div>
  );
}
